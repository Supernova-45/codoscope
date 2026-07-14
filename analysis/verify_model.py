"""Smoke-test DeCodon loading, token layout, hidden-state hooks, and gradients."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from analysis.decodon_lens_model import load_lens_model, prompt_from_codons


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--fixture", default="data/atlas_fixture.json")
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    fixture = json.loads(Path(args.fixture).read_text())
    codons = [token["codon"] for token in fixture["tokens"][:24]]
    lens_model = load_lens_model(args.model_dir, device=args.device)
    prompt = prompt_from_codons(562, codons)
    input_ids = lens_model.encode(prompt, max_length=32)
    expected = [
        lens_model.vocab["<CLS>"],
        lens_model.vocab["<562>"],
        *(lens_model.vocab[codon] for codon in codons),
        lens_model.vocab["<SEP>"],
    ]
    if input_ids[0].tolist() != expected:
        raise AssertionError("Tokenizer does not reproduce validated DeCodon layout")

    activation: torch.Tensor | None = None

    def capture(_module, _inputs, output):
        nonlocal activation
        activation = output[0] if isinstance(output, tuple) else output
        activation.requires_grad_(True)

    handle = lens_model.layers[0].register_forward_hook(capture)
    try:
        with torch.enable_grad():
            lens_model.forward(input_ids)
            if activation is None or not activation.requires_grad:
                raise AssertionError("Residual activation was not captured with gradients")
            scalar = activation[:, -2, 0].sum()
            gradient = torch.autograd.grad(scalar, activation)[0]
            if not torch.isfinite(gradient).all():
                raise AssertionError("Non-finite residual gradient")
    finally:
        handle.remove()

    with torch.inference_mode():
        output = lens_model.model(input_ids=input_ids, use_cache=False)
    print(
        json.dumps(
            {
                "model": type(lens_model.model).__name__,
                "layers": lens_model.n_layers,
                "hidden_size": lens_model.d_model,
                "vocab_size": len(lens_model.vocab),
                "sequence_length": int(input_ids.shape[1]),
                "logits_shape": list(output.logits.shape),
                "gradient_check": "passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
