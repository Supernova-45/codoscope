"""Resolve DeCodon's supported taxids once for fast, offline API search."""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vocab", default="decodon_model/vocab.json")
    parser.add_argument("--output", default="data/organisms.json")
    parser.add_argument("--batch-size", type=int, default=200)
    args = parser.parse_args()

    vocab = json.loads(Path(args.vocab).read_text())
    taxids = sorted(
        int(token[1:-1])
        for token in vocab
        if token.startswith("<") and token[1:-1].isdigit()
    )
    names: dict[str, str] = {}
    supported = set(taxids)
    for offset in range(0, len(taxids), args.batch_size):
        batch = taxids[offset : offset + args.batch_size]
        query = urllib.parse.urlencode({
            "db": "taxonomy",
            "id": ",".join(map(str, batch)),
            "retmode": "xml",
            "tool": "codoscope",
        })
        request = urllib.request.Request(
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?{query}",
            headers={"User-Agent": "Codoscope/1.0"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            root = ET.fromstring(response.read())
        for taxon in root.findall(".//Taxon"):
            taxid = taxon.findtext("TaxId")
            name = taxon.findtext("ScientificName")
            if taxid and name and int(taxid) in supported:
                names[taxid] = name
        time.sleep(0.35)

    missing = [taxid for taxid in taxids if str(taxid) not in names]
    for taxid in missing:
        names[str(taxid)] = f"taxid_{taxid}"
    output = Path(args.output)
    output.write_text(json.dumps(names, indent=2, sort_keys=True) + "\n")
    print(
        f"Wrote {len(names)} organism names to {output} "
        f"({len(missing)} unresolved taxids retained by identifier)"
    )


if __name__ == "__main__":
    main()
