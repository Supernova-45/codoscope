# DeCodon Jacobian-lens pipeline

This directory turns the public DeCodon checkpoint into reproducible,
provenance-tagged static atlas documents. Generated weights, checkpoints, and
raw CDS records stay in `analysis/artifacts/` and are ignored by Git.

## Environment

Use Python 3.12. DeCodon's public code is compatible with its declared
Transformers 4.44.2 runtime; newer Transformers versions produced non-finite
activations in the first decoder block during testing.

```bash
python3.12 -m venv .venv
.venv/bin/python -m analysis.bootstrap
```

`analysis.bootstrap` installs the pinned backend/model stack, then installs
Anthropic's `jlens` commit without its generic Transformers dependency.
Codoscope implements the `LensModel` protocol directly.

## Reproduce

```bash
# Immutable model revision + SHA-256 manifest
HF_HOME=.hf-cache .venv/bin/python -m analysis.download_model

# 100 fitting CDS + 20 held-out CDS, balanced across three bacterial genomes
.venv/bin/python -m analysis.build_corpus --count 120

# Verify hooks, finite gradients, and causal future-to-past zero
HF_HOME=.hf-cache .venv/bin/python -m analysis.jacobian_smoke

# Fit J_l over the first 100 corpus records
HF_HOME=.hf-cache .venv/bin/python -m analysis.fit_lens \
  --max-prompts 100 --dim-batch 8 --max-seq-len 128

# Compare against the direct logit-lens identity control on held-out records
HF_HOME=.hf-cache .venv/bin/python -m analysis.validate_lens \
  --max-sequences 10

# Export only after validation reports status=passed
HF_HOME=.hf-cache .venv/bin/python -m analysis.export_jacobian_lens
```

For the separately labeled nonlinear logit-lens baseline:

```bash
HF_HOME=.hf-cache .venv/bin/python -m analysis.export_logit_lens
```

## Estimator and indexing

The fit uses the official future-position estimator:

`J_l = E[prompt, t, t' >= t] [d h_final,t' / d h_l,t]`

Input layout is `[CLS, taxid, codon_0, ..., codon_n, SEP]`. Fitting excludes
positions 0–2 (`CLS`, taxid, and the first context-free codon). Decoder block
outputs 0–10 are transported to block 11; the UI labels those residual states
L1–L11 and appends the model's actual final output as L12.

The public JSON stores top-k probability objects and complete integer rank
tracks for all 64 codons. Scores are softmax probabilities restricted to the
64 codon tokens, matching the final-output baseline.

## Scientific gate

The exporter refuses to emit `method: "jacobian_lens"` unless
`analysis/lens_validation.json` says `status: "passed"`. The gate requires
finite held-out metrics and better codon NLL than the direct logit lens on at
least one third of fitted layers. The causal smoke test separately verifies
that future residual positions have zero effect on earlier targets.
