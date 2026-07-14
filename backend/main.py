"""
Codoscope FastAPI backend — Tier 1 live DeCodon inference.

Run: uvicorn backend.main:app --host 0.0.0.0 --port 8000
Requires: extract decodon200m_model.tar.gz to ./decodon_model
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "adapter"))

from decodon_adapter import build_document, load_decodon  # noqa: E402

MODEL_DIR = os.environ.get("DECODON_MODEL_DIR", str(ROOT / "decodon_model"))
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,https://supernova-45.github.io",
).split(",")

# Lazy model singleton
_model = None
_vocab = None
_code_table = None
_organism_cache: dict[int, str] = {}


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
        if not Path(MODEL_DIR).exists():
            raise HTTPException(
                status_code=503,
                detail=f"Model not found at {MODEL_DIR}. Extract decodon200m_model.tar.gz.",
            )
        _model, _vocab = load_decodon(MODEL_DIR)
    return _model, _vocab


def _validate_cds(sequence: str) -> list[str]:
    seq = sequence.upper().strip()
    if not seq:
        raise HTTPException(400, "Empty sequence")
    if not all(c in "ACGT" for c in seq):
        raise HTTPException(400, "Sequence must contain only A, C, G, T")
    if len(seq) % 3 != 0:
        raise HTTPException(400, f"Length {len(seq)} is not divisible by 3")
    if not seq.startswith("ATG"):
        raise HTTPException(400, "CDS must start with ATG (start codon)")
    codons = [seq[i : i + 3] for i in range(0, len(seq), 3)]
    if len(codons) < 20:
        raise HTTPException(400, "Sequence must be at least 20 codons")
    stops = {"TAA", "TAG", "TGA"}
    internal_stops = [i for i, c in enumerate(codons[:-1]) if c in stops]
    if internal_stops:
        raise HTTPException(400, f"Internal stop codon at position(s): {internal_stops}")
    if codons[-1] in stops:
        codons = codons[:-1]
    if len(codons) > 512:
        raise HTTPException(400, "Maximum 512 codons per request")
    return codons


def _taxid_label(taxid: int, vocab: dict) -> str:
    tok = f"<{taxid}>"
    if tok not in vocab:
        raise HTTPException(400, f"Taxid {taxid} not in model vocabulary")
    name = _organism_cache.get(taxid)
    if not name:
        name = _lookup_taxid_name(taxid)
        _organism_cache[taxid] = name
    return f"{name} ({taxid})"


def _lookup_taxid_name(taxid: int) -> str:
    defaults = {562: "E. coli", 1423: "B. subtilis", 287: "P. aeruginosa"}
    if taxid in defaults:
        return defaults[taxid]
    try:
        import urllib.request
        url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=taxonomy&id={taxid}&retmode=xml"
        with urllib.request.urlopen(url, timeout=5) as resp:
            xml = resp.read().decode()
        import re
        m = re.search(r"<ScientificName>([^<]+)</ScientificName>", xml)
        if m:
            return m.group(1)
    except Exception:
        pass
    return f"taxid_{taxid}"


class AtlasRequest(BaseModel):
    sequence: str
    organisms: list[int] = Field(..., min_length=1, max_length=5)


app = FastAPI(title="Codoscope API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    model_ready = Path(MODEL_DIR).exists()
    return {"status": "ok", "model_ready": model_ready}


@app.get("/api/organisms")
def list_organisms(limit: int = 100):
    _, vocab = _get_model()
    taxids = sorted(
        int(k[1:-1]) for k in vocab if k.startswith("<") and k[1:-1].isdigit()
    )
    return [
        {"taxid": t, "name": _lookup_taxid_name(t)} for t in taxids[:limit]
    ]


@app.post("/api/atlas")
def create_atlas(req: AtlasRequest):
    model, vocab = _get_model()
    code = _get_codon_table()
    codon_list = _validate_cds(req.sequence)

    organisms = {}
    for taxid in req.organisms:
        organisms[_taxid_label(taxid, vocab)] = taxid

    doc = build_document(
        model, vocab, code,
        sequence_id="user_sequence",
        codon_list=codon_list,
        organisms=organisms,
    )

    concept_path = ROOT / "data" / "concept_layers.json"
    if concept_path.exists():
        doc["concept_layers"] = json.loads(concept_path.read_text())

    return doc
