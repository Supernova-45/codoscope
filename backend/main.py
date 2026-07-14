"""
Codoscope FastAPI backend — Tier 1 live DeCodon inference.

Run: uvicorn backend.main:app --host 0.0.0.0 --port 8000
Requires: extract decodon200m_model.tar.gz to ./decodon_model
"""
from __future__ import annotations

import json
import hashlib
import os
import re
import sys
import threading
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from pathlib import Path

import anyio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from jsonschema import ValidationError as JSONSchemaError
from jsonschema import validate as validate_json

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "adapter"))

from decodon_adapter import build_document, load_decodon  # noqa: E402
from jacobian_adapter import (  # noqa: E402
    RuntimeJacobianLens,
    attach_jacobian_lens,
)
from backend.validation import CDSValidationError, validate_cds  # noqa: E402

MODEL_DIR = os.environ.get("DECODON_MODEL_DIR", str(ROOT / "decodon_model"))
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,https://supernova-45.github.io",
).split(",")
PRELOAD_MODEL = os.environ.get("PRELOAD_MODEL", "0") == "1"
LENS_PATH = os.environ.get("DECODON_LENS_PATH", "")
LENS_VALIDATION_PATH = os.environ.get("DECODON_LENS_VALIDATION_PATH", "")

# Lazy model singleton
_model = None
_vocab = None
_lens = None
_code_table = None
_organism_cache: dict[int, str] = {}
_model_lock = threading.Lock()
_lens_lock = threading.Lock()
_vocab_lock = threading.Lock()
_inference_slot = threading.BoundedSemaphore(value=1)
_taxonomy_lock = threading.Lock()
_cache_lock = threading.Lock()
_result_cache: dict[str, dict] = {}
_result_cache_order: list[str] = []
_schema = json.loads((ROOT / "adapter" / "schema.json").read_text())
_required_model_files = (
    "config.json",
    "configuration_decodon.py",
    "model.safetensors",
    "modeling_decodon.py",
    "vocab.json",
)

KNOWN_ORGANISMS = {
    287: "Pseudomonas aeruginosa",
    562: "Escherichia coli",
    1423: "Bacillus subtilis",
}
_organism_cache.update(KNOWN_ORGANISMS)
_taxonomy_cache_path = ROOT / "data" / "organisms.json"
if _taxonomy_cache_path.exists():
    _organism_cache.update({
        int(taxid): name
        for taxid, name in json.loads(_taxonomy_cache_path.read_text()).items()
    })


def _model_files_ready() -> bool:
    return all((Path(MODEL_DIR) / name).is_file() for name in _required_model_files)


def _get_codon_table() -> dict[str, str]:
    global _code_table
    if _code_table is None:
        try:
            from Bio.Data.CodonTable import standard_dna_table
            table = standard_dna_table.forward_table
            _code_table = {codon: aa for codon, aa in table.items()}
            for stop in ("TAA", "TAG", "TGA"):
                _code_table[stop] = "*"
        except ImportError:
            _code_table = _builtin_codon_table()
    return _code_table


def _builtin_codon_table() -> dict[str, str]:
    """Standard genetic code table 1 fallback."""
    return {
        "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
        "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
        "TAT": "Y", "TAC": "Y", "TGT": "C", "TGC": "C", "TGG": "W",
        "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
        "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
        "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
        "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
        "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
        "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
        "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
        "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
        "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
        "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
        "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
        "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
        "TAA": "*", "TAG": "*", "TGA": "*",
    }


def _get_model():
    global _model, _vocab
    if _model is None:
        with _model_lock:
            if _model is None:
                if not _model_files_ready():
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "DeCodon model files are not installed on this server. "
                            "The static atlas remains available."
                        ),
                    )
                _model, _vocab = load_decodon(MODEL_DIR)
    return _model, _vocab


def _get_lens() -> RuntimeJacobianLens | None:
    global _lens
    if not LENS_PATH or not LENS_VALIDATION_PATH:
        return None
    if _lens is None:
        with _lens_lock:
            if _lens is None:
                _lens = RuntimeJacobianLens(
                    LENS_PATH,
                    LENS_VALIDATION_PATH,
                )
    return _lens


def _get_vocab() -> dict[str, int]:
    global _vocab
    if _vocab is None:
        with _vocab_lock:
            if _vocab is None:
                vocab_path = Path(MODEL_DIR) / "vocab.json"
                if not vocab_path.exists():
                    raise HTTPException(
                        status_code=503,
                        detail="DeCodon vocabulary is not installed on this server.",
                    )
                _vocab = json.loads(vocab_path.read_text())
    return _vocab


def _taxid_label(taxid: int, vocab: dict) -> str:
    tok = f"<{taxid}>"
    if tok not in vocab:
        raise HTTPException(400, f"Taxid {taxid} not in model vocabulary")
    name = _organism_cache.get(taxid)
    if not name:
        name = _resolve_taxid_names([taxid]).get(taxid, f"taxid_{taxid}")
    return f"{name} ({taxid})"


def _resolve_taxid_names(taxids: list[int]) -> dict[int, str]:
    missing = [taxid for taxid in taxids if taxid not in _organism_cache]
    if not missing:
        return {taxid: _organism_cache[taxid] for taxid in taxids}

    with _taxonomy_lock:
        missing = [taxid for taxid in missing if taxid not in _organism_cache]
        for offset in range(0, len(missing), 200):
            batch = missing[offset : offset + 200]
            query = urllib.parse.urlencode({
                "db": "taxonomy",
                "id": ",".join(str(taxid) for taxid in batch),
                "retmode": "xml",
                "tool": "codoscope",
            })
            try:
                request = urllib.request.Request(
                    f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?{query}",
                    headers={"User-Agent": "Codoscope/1.0"},
                )
                with urllib.request.urlopen(request, timeout=15) as response:
                    root = ET.fromstring(response.read())
                for taxon in root.findall(".//Taxon"):
                    taxid_text = taxon.findtext("TaxId")
                    name = taxon.findtext("ScientificName")
                    if taxid_text and name:
                        _organism_cache[int(taxid_text)] = name
            except (OSError, ET.ParseError):
                # The API remains useful offline; unresolved entries retain taxids.
                continue

    return {
        taxid: _organism_cache.get(taxid, f"taxid_{taxid}")
        for taxid in taxids
    }


class AtlasRequest(BaseModel):
    sequence: str = Field(..., min_length=1, max_length=5_000)
    organisms: list[int] = Field(..., min_length=1, max_length=5)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if PRELOAD_MODEL and Path(MODEL_DIR).exists():
        await anyio.to_thread.run_sync(_get_model)
        if LENS_PATH:
            await anyio.to_thread.run_sync(_get_lens)
    yield


app = FastAPI(
    title="Codoscope API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    model_ready = _model_files_ready()
    payload = {
        "status": "ok" if model_ready else "degraded",
        "model_ready": model_ready,
        "model_loaded": _model is not None,
        "lens_configured": bool(LENS_PATH and LENS_VALIDATION_PATH),
        "lens_loaded": _lens is not None,
    }
    return JSONResponse(payload, status_code=200 if model_ready else 503)


@app.get("/api/capabilities")
def capabilities():
    return {
        "final_output": True,
        "jacobian_lens": bool(LENS_PATH and LENS_VALIDATION_PATH),
        "static_fallback": True,
        "translation_table": 1,
        "start_codon_filter": "ATG",
    }


@app.get("/api/organisms")
def list_organisms(
    query: str = Query(default="", max_length=100),
    limit: int = Query(default=100, ge=1, le=200),
):
    vocab = _get_vocab()
    taxids = sorted(
        int(k[1:-1]) for k in vocab if k.startswith("<") and k[1:-1].isdigit()
    )
    normalized_query = query.strip().lower()
    if normalized_query.isdigit():
        candidates = [
            taxid for taxid in taxids
            if normalized_query in str(taxid)
        ][:limit]
    elif normalized_query:
        candidates = [
            taxid for taxid in taxids
            if (
                normalized_query in _organism_cache.get(taxid, "").lower()
                or normalized_query in str(taxid)
            )
        ][:limit]
    else:
        preferred = [taxid for taxid in KNOWN_ORGANISMS if taxid in taxids]
        candidates = (preferred + [
            taxid for taxid in taxids if taxid not in KNOWN_ORGANISMS
        ])[:limit]

    names = _resolve_taxid_names(candidates)
    return [{"taxid": taxid, "name": names[taxid]} for taxid in candidates]


@app.post("/api/atlas")
def create_atlas(req: AtlasRequest):
    try:
        validated = validate_cds(req.sequence)
    except CDSValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    vocab = _get_vocab()
    unique_taxids = list(dict.fromkeys(req.organisms))
    organisms = {
        _taxid_label(taxid, vocab): taxid
        for taxid in unique_taxids
    }

    sequence_id = f"user_{hashlib.sha256(validated.sequence.encode()).hexdigest()[:12]}"
    cache_key = hashlib.sha256(
        (
            f"{validated.sequence}|{','.join(map(str, unique_taxids))}"
            f"|lens={Path(LENS_PATH).name if LENS_PATH else 'none'}"
        ).encode()
    ).hexdigest()
    with _cache_lock:
        cached = _result_cache.get(cache_key)
    if cached is not None:
        return cached

    model, vocab = _get_model()
    code = _get_codon_table()
    if not _inference_slot.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="The model is processing another sequence. Please retry shortly.",
            headers={"Retry-After": "2"},
        )
    try:
        doc = build_document(
            model,
            vocab,
            code,
            sequence_id=sequence_id,
            codon_list=list(validated.codons),
            organisms=organisms,
        )
        runtime_lens = _get_lens()
        if runtime_lens is not None:
            doc = attach_jacobian_lens(
                doc,
                model,
                vocab,
                code,
                list(validated.codons),
                organisms,
                runtime_lens,
            )
    finally:
        _inference_slot.release()

    concept_path = ROOT / "data" / "concept_layers.json"
    if concept_path.exists():
        doc["concept_layers"] = json.loads(concept_path.read_text())

    try:
        validate_json(instance=doc, schema=_schema)
    except JSONSchemaError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Generated atlas failed schema validation: {error.message}",
        ) from error

    with _cache_lock:
        _result_cache[cache_key] = doc
        _result_cache_order.append(cache_key)
        while len(_result_cache_order) > 32:
            oldest = _result_cache_order.pop(0)
            _result_cache.pop(oldest, None)

    return doc
