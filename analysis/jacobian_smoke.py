"""Small causal-gradient gate before committing resources to a full lens fit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from jlens.hooks import ActivationRecorder

from analysis.decodon_lens_model import load_lens_model, prompt_from_codons


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--fixture", default="data/atlas_fixture.json")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--codons", type=int, default=6)
    parser.add_argument("--source-layer", type=int, default=10)
    parser.add_argument("--target-layer", type=int, default=11)
    parser.add_argument("--detect-anomaly", action="store_true")
    args = parser.parse_args()

    fixture = json.loads(Path(args.fixture).read_text())
    codons = [token["codon"] for token in fixture["tokens"][: args.codons]]
    model = load_lens_model(args.model_dir, device=args.device)
    input_ids = model.encode(prompt_from_codons(562, codons), max_length=args.codons + 3)
    source_position = 3  # first context-conditioned codon
    target_position = min(source_position + 2, input_ids.shape[1] - 2)

    with (
        ActivationRecorder(
            model.layers,
            at=[args.source_layer, args.target_layer],
            start_graph_at=args.source_layer,
        ) as recorder,
        torch.enable_grad(),
    ):
        model.forward(input_ids)
        source = recorder.activations[args.source_layer]
        target = recorder.activations[args.target_layer]
        with torch.autograd.detect_anomaly(check_nan=True) if args.detect_anomaly else torch.enable_grad():
            gradient = torch.autograd.grad(
                target[:, target_position, 0].sum(),
                source,
            )[0][0]

    future_leak = float(gradient[target_position + 1 :].abs().max().item())
    past_effect = float(gradient[: target_position + 1].norm().item())
    result = {
        "source_layer": args.source_layer,
        "target_layer": args.target_layer,
        "source_sequence_length": int(input_ids.shape[1]),
        "source_activation_finite": bool(torch.isfinite(source).all()),
        "target_activation_finite": bool(torch.isfinite(target).all()),
        "gradient_finite": bool(torch.isfinite(gradient).all()),
        "past_and_present_gradient_norm": past_effect,
        "future_position_max_abs_gradient": future_leak,
        "causality_gate": future_leak < 1e-7 and past_effect > 0,
    }
    print(json.dumps(result, indent=2))
    if not result["gradient_finite"] or not result["causality_gate"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
