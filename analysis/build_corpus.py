"""Build a balanced, provenance-recorded clean-CDS corpus for lens fitting."""

from __future__ import annotations

import argparse
import io
import json
import random
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from Bio import SeqIO

SOURCES = (
    {
        "taxid": 562,
        "organism": "Escherichia coli K-12 MG1655",
        "accession": "NC_000913.3",
    },
    {
        "taxid": 1423,
        "organism": "Bacillus subtilis 168",
        "accession": "NC_000964.3",
    },
    {
        "taxid": 287,
        "organism": "Pseudomonas aeruginosa PAO1",
        "accession": "NC_002516.2",
    },
)
STOPS = {"TAA", "TAG", "TGA"}


def fetch_cds(accession: str) -> list[tuple[str, str]]:
    query = urllib.parse.urlencode(
        {
            "db": "nuccore",
            "id": accession,
            "rettype": "fasta_cds_na",
            "retmode": "text",
            "tool": "codoscope",
        }
    )
    request = urllib.request.Request(
        f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?{query}",
        headers={"User-Agent": "Codoscope/1.0"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        text = response.read().decode()
    return [
        (record.id, str(record.seq).upper())
        for record in SeqIO.parse(io.StringIO(text), "fasta")
    ]


def clean_cds(sequence: str, *, min_codons: int, max_codons: int) -> list[str] | None:
    if not sequence or set(sequence) - set("ACGT") or len(sequence) % 3:
        return None
    codons = [sequence[i : i + 3] for i in range(0, len(sequence), 3)]
    if not codons or codons[0] != "ATG":
        return None
    if codons[-1] in STOPS:
        codons = codons[:-1]
    if any(codon in STOPS for codon in codons):
        return None
    if not min_codons <= len(codons) <= max_codons:
        return None
    return codons


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260713)
    parser.add_argument("--min-codons", type=int, default=24)
    parser.add_argument("--max-codons", type=int, default=126)
    parser.add_argument("--output", default="analysis/artifacts/corpus.jsonl")
    parser.add_argument("--manifest", default="analysis/corpus_manifest.json")
    args = parser.parse_args()

    randomizer = random.Random(args.seed)
    per_source = (args.count + len(SOURCES) - 1) // len(SOURCES)
    groups: list[list[dict[str, object]]] = []
    source_counts: dict[str, int] = {}

    for source in SOURCES:
        candidates = []
        for record_id, sequence in fetch_cds(source["accession"]):
            codons = clean_cds(
                sequence,
                min_codons=args.min_codons,
                max_codons=args.max_codons,
            )
            if codons is not None:
                candidates.append(
                    {
                        **source,
                        "record_id": record_id,
                        "codons": codons,
                        "prompt": f"<{source['taxid']}>{''.join(codons)}",
                    }
                )
        randomizer.shuffle(candidates)
        selected = candidates[:per_source]
        groups.append(selected)
        source_counts[source["accession"]] = len(selected)

    records = [
        record
        for index in range(per_source)
        for group in groups
        for record in group[index : index + 1]
    ][: args.count]
    if len(records) < args.count:
        raise RuntimeError(f"Only found {len(records)} clean CDS for requested {args.count}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w") as file:
        for record in records:
            file.write(json.dumps(record, separators=(",", ":")) + "\n")

    manifest = {
        "schema_version": "codoscope/lens-corpus-1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "count": len(records),
        "filters": {
            "translation_table": 1,
            "start_codon": "ATG",
            "alphabet": "ACGT",
            "internal_stops": False,
            "min_codons": args.min_codons,
            "max_codons": args.max_codons,
        },
        "sources": list(SOURCES),
        "selected_per_accession": source_counts,
        "fitting_note": "Input positions 0–2 (CLS, taxid, first codon) are excluded.",
    }
    Path(args.manifest).write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(records)} balanced CDS to {output}")


if __name__ == "__main__":
    main()
