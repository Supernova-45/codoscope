"""Export a real per-layer nonlinear logit-lens baseline for the static atlas."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

import torch
from Bio.Data.CodonTable import standard_dna_table
from jsonschema import validate as validate_json

from analysis.decodon_lens_model import load_lens_model
from analysis.download_model import MODEL_REVISION

AA3 = {
    "A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys",
    "E": "Glu", "Q": "Gln", "G": "Gly", "H": "His", "I": "Ile",
    "L": "Leu", "K": "Lys", "M": "Met", "F": "Phe", "P": "Pro",
    "S": "Ser", "T": "Thr", "W": "Trp", "Y": "Tyr", "V": "Val",
    "*": "Stop",
}


def genetic_code() -> dict[str, str]:
    code = dict(standard_dna_table.forward_table)
    code.update({codon: "*" for codon in standard_dna_table.stop_codons})
    return code


def ranked_entries(
    labels: list[str],
    probabilities: torch.Tensor,
    *,
    kind: str,
    top_k: int,
) -> list[dict[str, object]]:
    indices = torch.argsort(probabilities, descending=True)[:top_k].tolist()
    return [
        {
            "label": labels[index],
            "kind": kind,
            "score": round(float(probabilities[index]), 6),
            "rank": rank + 1,
        }
        for rank, index in enumerate(indices)
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--fixture", default="data/atlas_fixture.json")
    parser.add_argument("--schema", default="adapter/schema.json")
    parser.add_argument(
        "--output",
        default="public/data/examples/ecoli_logit_lens.json",
    )
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--top-k", type=int, default=8)
    args = parser.parse_args()

    document = json.loads(Path(args.fixture).read_text())
    model = load_lens_model(args.model_dir, device=args.device)
    code = genetic_code()
    codon_ids = model.codon_token_ids()
    codons = sorted(codon_ids)
    vocabulary_columns = torch.tensor(
        [codon_ids[codon] for codon in codons],
        device=model.input_device,
    )
    amino_acids = sorted(set(code.values()))
    aa_indices = {
        aa: [index for index, codon in enumerate(codons) if code[codon] == aa]
        for aa in amino_acids
    }
    sequence_codons = [token["codon"] for token in document["tokens"]]
    ids_for_codons = [model.vocab[codon] for codon in sequence_codons]
    layers = list(range(model.n_layers + 1))
    per_organism: dict[str, list[dict[str, object]]] = {}
    rank_tracks: dict[str, dict[str, list[list[int]]]] = {}

    for organism in document["organisms"]:
        match = re.search(r"\((\d+)\)$", organism)
        if not match:
            raise ValueError(f"Organism label has no taxid: {organism}")
        taxid = int(match.group(1))
        input_ids = torch.tensor(
            [[
                model.vocab["<CLS>"],
                model.vocab[f"<{taxid}>"],
                *ids_for_codons,
                model.vocab["<SEP>"],
            ]],
            device=model.input_device,
        )
        with torch.inference_mode():
            output = model.model(
                input_ids=input_ids,
                output_hidden_states=True,
                use_cache=False,
            )
        hidden_states = output.hidden_states
        if hidden_states is None or len(hidden_states) != len(layers):
            raise RuntimeError(
                f"Expected {len(layers)} hidden states, found "
                f"{0 if hidden_states is None else len(hidden_states)}"
            )

        positions = [
            {"pos": position, "layers": []}
            for position in range(len(sequence_codons))
        ]
        organism_ranks = {
            codon: [
                [0 for _ in layers]
                for _ in sequence_codons
            ]
            for codon in codons
        }

        for layer, hidden in zip(layers, hidden_states, strict=True):
            with torch.inference_mode():
                logits = model.unembed(hidden)[0, 1 : 1 + len(sequence_codons)]
                codon_probabilities = torch.softmax(
                    logits.index_select(-1, vocabulary_columns).float(),
                    dim=-1,
                ).cpu()

            for position, probabilities in enumerate(codon_probabilities):
                aa_probabilities = torch.tensor([
                    float(probabilities[aa_indices[aa]].sum())
                    for aa in amino_acids
                ])
                positions[position]["layers"].append(
                    {
                        "layer": layer,
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
                order = torch.argsort(probabilities, descending=True).tolist()
                for rank, codon_index in enumerate(order, start=1):
                    organism_ranks[codons[codon_index]][position][layer] = rank

        if any(
            rank <= 0
            for rows in organism_ranks.values()
            for row in rows
            for rank in row
        ):
            raise RuntimeError("Incomplete codon rank tracks")
        per_organism[organism] = positions
        rank_tracks[organism] = organism_ranks

    document["schema_version"] = "biojspace/decodon-1.1"
    document["lens"] = {
        "method": "logit_lens",
        "status": "baseline",
        "layers": layers,
        "top_k": args.top_k,
        "model_revision": MODEL_REVISION,
        "score_units": "probability",
        "normalization": "softmax restricted to the 64 codon output tokens",
        "source_position": "same autoregressive prediction position",
        "target_positions": "current position only; no Jacobian transport",
        "per_organism": per_organism,
        "rank_tracks": rank_tracks,
    }

    # Verify the final logit-lens layer agrees with ordinary output probabilities.
    for organism in document["organisms"]:
        for position, final_readout in enumerate(document["per_organism"][organism]):
            lens_aa = per_organism[organism][position]["layers"][-1]["aa_readout"][0]
            output_aa = final_readout["aa_readout"][0]
            if lens_aa["label"] != output_aa["label"]:
                raise RuntimeError(
                    f"Final-layer AA mismatch at {organism} position {position}"
                )
            if not math.isclose(
                float(lens_aa["score"]),
                float(output_aa["score"]),
                abs_tol=2e-3,
            ):
                raise RuntimeError(
                    f"Final-layer probability mismatch at {organism} position {position}"
                )

    validate_json(document, json.loads(Path(args.schema).read_text()))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(document, separators=(",", ":")))
    print(output_path)


if __name__ == "__main__":
    main()
