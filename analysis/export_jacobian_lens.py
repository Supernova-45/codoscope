"""Export a fitted DeCodon Jacobian lens into the versioned atlas contract."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import torch
from Bio.Data.CodonTable import standard_dna_table
from jlens import JacobianLens
from jsonschema import validate as validate_json

from analysis.decodon_lens_model import load_lens_model, prompt_from_codons
from analysis.download_model import JLENS_REVISION, MODEL_REVISION
from analysis.export_logit_lens import AA3, ranked_entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--lens", default="analysis/artifacts/decodon_jlens.pt")
    parser.add_argument("--fit-manifest", default="analysis/lens_fit_manifest.json")
    parser.add_argument("--validation", default="analysis/lens_validation.json")
    parser.add_argument("--fixture", default="data/atlas_fixture.json")
    parser.add_argument("--schema", default="adapter/schema.json")
    parser.add_argument(
        "--output",
        default="public/data/examples/ecoli_jacobian_lens.json",
    )
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--top-k", type=int, default=8)
    args = parser.parse_args()

    document = json.loads(Path(args.fixture).read_text())
    fit_manifest = json.loads(Path(args.fit_manifest).read_text())
    validation = json.loads(Path(args.validation).read_text())
    if validation.get("status") != "passed":
        raise RuntimeError(
            "Refusing to label this artifact jacobian_lens: validation gates did not pass"
        )
    model = load_lens_model(args.model_dir, device=args.device)
    lens = JacobianLens.load(args.lens)
    codon_ids = model.codon_token_ids()
    codons = sorted(codon_ids)
    codon_columns = torch.tensor([codon_ids[codon] for codon in codons])
    code = dict(standard_dna_table.forward_table)
    code.update({codon: "*" for codon in standard_dna_table.stop_codons})
    amino_acids = sorted(set(code.values()))
    aa_indices = {
        aa: [index for index, codon in enumerate(codons) if code[codon] == aa]
        for aa in amino_acids
    }
    sequence_codons = [token["codon"] for token in document["tokens"]]
    positions_to_read = [1 + position for position in range(len(sequence_codons))]
    display_layers = [layer + 1 for layer in lens.source_layers] + [model.n_layers]
    per_organism: dict[str, list[dict[str, object]]] = {}
    rank_tracks: dict[str, dict[str, list[list[int]]]] = {}

    for organism in document["organisms"]:
        match = re.search(r"\((\d+)\)$", organism)
        if not match:
            raise ValueError(f"Organism label has no taxid: {organism}")
        prompt = prompt_from_codons(int(match.group(1)), sequence_codons)
        lens_logits, model_logits, _ = lens.apply(
            model,
            prompt,
            positions=positions_to_read,
            max_seq_len=len(sequence_codons) + 3,
        )
        logits_by_layer = [
            lens_logits[layer] for layer in lens.source_layers
        ] + [model_logits]
        positions = [
            {"pos": position, "layers": []}
            for position in range(len(sequence_codons))
        ]
        organism_ranks = {
            codon: [[0 for _ in display_layers] for _ in sequence_codons]
            for codon in codons
        }

        for layer_index, (display_layer, logits) in enumerate(
            zip(display_layers, logits_by_layer, strict=True)
        ):
            probabilities_by_position = torch.softmax(
                logits.index_select(-1, codon_columns).float(),
                dim=-1,
            )
            for position, probabilities in enumerate(probabilities_by_position):
                aa_probabilities = torch.tensor([
                    float(probabilities[aa_indices[aa]].sum())
                    for aa in amino_acids
                ])
                positions[position]["layers"].append(
                    {
                        "layer": display_layer,
                        "pos": position,
                        "aa_readout": ranked_entries(
                            [AA3[aa] for aa in amino_acids],
                            aa_probabilities,
                            kind="aa_mean",
                            top_k=min(5, len(amino_acids)),
                        ),
                        "codon_readout": ranked_entries(
                            codons,
                            probabilities,
                            kind="codon",
                            top_k=min(args.top_k, len(codons)),
                        ),
                    }
                )
                for rank, codon_index in enumerate(
                    torch.argsort(probabilities, descending=True).tolist(),
                    start=1,
                ):
                    organism_ranks[codons[codon_index]][position][layer_index] = rank

        per_organism[organism] = positions
        rank_tracks[organism] = organism_ranks

    document["schema_version"] = "biojspace/decodon-1.1"
    document["lens"] = {
        "method": "jacobian_lens",
        "status": "validated",
        "layers": display_layers,
        "top_k": args.top_k,
        "model_revision": MODEL_REVISION,
        "lens_revision": JLENS_REVISION,
        "score_units": "probability",
        "normalization": "softmax restricted to the 64 codon output tokens",
        "source_position": "same autoregressive prediction position",
        "target_positions": "averaged over current and future positions in fitting corpus",
        "fit": {
            "corpus_manifest": fit_manifest["corpus_manifest"],
            "n_sequences": fit_manifest["n_prompts"],
            "skip_first": fit_manifest["skip_first"],
        },
        "per_organism": per_organism,
        "rank_tracks": rank_tracks,
    }
    validate_json(document, json.loads(Path(args.schema).read_text()))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, separators=(",", ":")))
    print(output)


if __name__ == "__main__":
    main()
