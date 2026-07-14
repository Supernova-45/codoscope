"""Held-out quality gates for a fitted DeCodon Jacobian lens."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import torch
from jlens import JacobianLens

from analysis.decodon_lens_model import load_lens_model
from analysis.download_model import JLENS_REVISION, MODEL_REVISION


def metrics(logits: torch.Tensor, targets: torch.Tensor) -> dict[str, float]:
    loss = torch.nn.functional.cross_entropy(logits, targets)
    accuracy = (logits.argmax(dim=-1) == targets).float().mean()
    return {"nll": float(loss), "top1_accuracy": float(accuracy)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--lens", default="analysis/artifacts/decodon_jlens.pt")
    parser.add_argument("--corpus", default="analysis/artifacts/corpus.jsonl")
    parser.add_argument("--output", default="analysis/lens_validation.json")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--max-sequences", type=int, default=10)
    parser.add_argument("--positions-per-sequence", type=int, default=12)
    args = parser.parse_args()

    records = [
        json.loads(line)
        for line in Path(args.corpus).read_text().splitlines()
        if line.strip()
    ][-args.max_sequences :]
    model = load_lens_model(args.model_dir, device=args.device)
    lens = JacobianLens.load(args.lens)
    codon_ids = model.codon_token_ids()
    codon_columns = torch.tensor([codon_ids[codon] for codon in sorted(codon_ids)])
    codon_index = {codon: index for index, codon in enumerate(sorted(codon_ids))}
    selected_layers = lens.source_layers
    totals = {
        "jacobian": {layer: [] for layer in selected_layers},
        "logit": {layer: [] for layer in selected_layers},
        "final": [],
    }

    for record in records:
        codons = record["codons"]
        start = 1
        stop = min(len(codons), start + args.positions_per_sequence)
        codon_positions = list(range(start, stop))
        model_positions = [1 + position for position in codon_positions]
        targets = torch.tensor([codon_index[codons[position]] for position in codon_positions])
        j_logits, final_logits, _ = lens.apply(
            model,
            record["prompt"],
            layers=selected_layers,
            positions=model_positions,
            max_seq_len=128,
        )
        logit_logits, _, _ = lens.apply(
            model,
            record["prompt"],
            layers=selected_layers,
            positions=model_positions,
            max_seq_len=128,
            use_jacobian=False,
        )
        totals["final"].append(metrics(final_logits[:, codon_columns], targets))
        for layer in selected_layers:
            totals["jacobian"][layer].append(
                metrics(j_logits[layer][:, codon_columns], targets)
            )
            totals["logit"][layer].append(
                metrics(logit_logits[layer][:, codon_columns], targets)
            )

    def average(rows: list[dict[str, float]]) -> dict[str, float]:
        return {
            key: sum(row[key] for row in rows) / len(rows)
            for key in rows[0]
        }

    jacobian = {str(layer): average(rows) for layer, rows in totals["jacobian"].items()}
    logit = {str(layer): average(rows) for layer, rows in totals["logit"].items()}
    final = average(totals["final"])
    finite = all(
        math.isfinite(value)
        for family in (jacobian, logit)
        for layer_metrics in family.values()
        for value in layer_metrics.values()
    ) and all(math.isfinite(value) for value in final.values())
    improved_layers = [
        layer for layer in selected_layers
        if jacobian[str(layer)]["nll"] < logit[str(layer)]["nll"]
    ]
    required_improvements = max(1, math.ceil(len(selected_layers) / 3))
    passed = finite and len(improved_layers) >= required_improvements

    result = {
        "schema_version": "codoscope/lens-validation-1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "passed" if passed else "failed",
        "model_revision": MODEL_REVISION,
        "jlens_revision": JLENS_REVISION,
        "n_held_out_sequences": len(records),
        "positions_per_sequence": args.positions_per_sequence,
        "gates": {
            "all_metrics_finite": finite,
            "jacobian_nll_better_than_logit_layers": improved_layers,
            "required_improved_layers": required_improvements,
        },
        "metrics": {
            "jacobian_lens": jacobian,
            "logit_lens_identity_control": logit,
            "final_output": final,
        },
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["gates"], indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
