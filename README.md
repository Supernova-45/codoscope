# Codoscope

**A biological J-space atlas** — an interactive website for reading what [DeCodon-200M](https://huggingface.co/goodarzilab/decodon-200M) is poised to output across a coding sequence. It combines final codon probabilities, global biological probes, a direct logit-lens baseline, and a fitted [Anthropic-style averaged Jacobian lens](https://transformer-circuits.pub/2026/workspace/index.html). Every view carries a method badge so those measurements are never conflated.

**Live demo:** [https://supernova-45.github.io/codoscope/](https://supernova-45.github.io/codoscope/)

## The idea

At every codon position, the final-output baseline separates two probabilities:

- **Amino-acid marginal** — codon probability mass grouped by encoded amino acid
- **Conditional synonym distribution** — codon probability within the observed amino-acid family

**The hero interaction:** hold the DNA sequence fixed and switch only DeCodon's organism token. The amino acid encoded by the input stays fixed by construction; the model's amino-acid confidence and conditional synonymous preference can both change. Codoscope shows both, including weak-organism calibration.

### Scope and scientific claim

The UI distinguishes four quantities:

- `DeCodon output`: actual final-layer probabilities restricted to the 64 codons
- `Independent probe`: global accuracy/R² trajectories, not selected-position output
- `Logit lens`: DeCodon's nonlinear LM head applied directly to each hidden layer
- `Jacobian lens`: residuals transported by a corpus-averaged causal Jacobian before decoding

Only artifacts that pass `analysis/validate_lens.py` may use the Jacobian-lens label. Organism switching is a model-input counterfactual on a fixed E. coli prefix, not proof that changing species causes a biological outcome.

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:5173/codoscope/ — the app loads real DeCodon output from `public/data/atlas_fixture.json` (60-codon *E. coli* gene × 3 organisms).

### Quality checks

```bash
npm run check       # lint, unit tests, production build
npm run test:e2e    # Playwright browser tests (install Chromium first)
.venv/bin/python -m unittest discover -s backend -p "test_*.py"
```

## Build & deploy

```bash
npm run build    # outputs to dist/
```

GitHub Pages deploys automatically from `main` and the current showcase branch via `.github/workflows/deploy.yml`.
The workflow validates the frontend, builds it with the correct `/codoscope/` base path, enables Pages when permissions allow, and uploads `dist/`.

## Reproduce the Jacobian lens

The public model and official lens code are pinned to immutable commits and
verified in `analysis/model_manifest.json`. Model weights and fitted matrices
are intentionally not committed.

```bash
python3.12 -m venv .venv
.venv/bin/python -m analysis.bootstrap
HF_HOME=.hf-cache .venv/bin/python -m analysis.download_model
.venv/bin/python -m analysis.build_corpus --count 120
HF_HOME=.hf-cache .venv/bin/python -m analysis.jacobian_smoke
HF_HOME=.hf-cache .venv/bin/python -m analysis.fit_lens --max-prompts 100
HF_HOME=.hf-cache .venv/bin/python -m analysis.validate_lens
HF_HOME=.hf-cache .venv/bin/python -m analysis.export_jacobian_lens
```

See [`analysis/README.md`](analysis/README.md) for estimator, indexing,
held-out gates, and artifact details. DeCodon must run on Transformers 4.44.2;
newer Transformers produced non-finite activations despite finite weights.

## Tier 1 — live inference backend

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
DOWNLOAD_MODEL=1 DECODON_MODEL_DIR="$PWD/decodon_model" \
  .venv/bin/python -m backend.start
```

Set `VITE_API_URL=http://localhost:8000` when building the frontend for live mode.

The API exposes:

- `GET /api/health` — service/model readiness
- `GET /api/capabilities` — final-output and optional lens availability
- `GET /api/organisms?query=coli` — supported model taxids with NCBI names
- `POST /api/atlas` — validated CDS + up to five taxids → frozen atlas contract
- `GET /api/docs` — OpenAPI documentation

### Container deployment

`backend/Dockerfile` runs a single CPU model worker and downloads an immutable
DeCodon revision into a persistent model directory on first boot. Startup
requires all model/custom-code files, verifies the 632 MB weight checksum, and
writes an atomic completion marker. The CPU xFormers import shim fails loudly
if flash attention is accidentally enabled.
`render.yaml` is a Render Blueprint with a 2 GB persistent disk and a
standard-memory instance; applying it may create billable infrastructure.

After deploying the API, define the GitHub repository variable
`VITE_API_URL=https://<your-api-host>` and rerun the Pages workflow. The
static atlas remains fully functional when no backend is configured.

Backend environment variables:

- `DECODON_MODEL_DIR` — model directory (default `./decodon_model` locally)
- `CORS_ORIGINS` — comma-separated allowed frontend origins
- `PRELOAD_MODEL=1` — load DeCodon before accepting production traffic
- `DOWNLOAD_MODEL=1` — allow `backend.start` to download a missing model
- `DECODON_LENS_PATH` — optional validated `jlens` artifact
- `DECODON_LENS_VALIDATION_PATH` — required passed validation manifest

## Project structure

```
codoscope/
├── public/data/          # atlas_fixture.json (real DeCodon output)
├── src/                  # React + TypeScript frontend
├── adapter/              # DeCodon → JSON contract adapter
├── analysis/             # pinned model, corpus, fit, validation, export pipeline
├── backend/              # FastAPI Tier 1 server
├── tests/                # Playwright browser tests
├── docs/                 # Science brief & implementation guide
├── data/                 # Source fixtures
└── evidence/             # Measurement memos behind design decisions
```

## Documentation

| Doc | Purpose |
|-----|---------|
| `docs/00_biology_primer.md` | Biology concepts (read first if not a biologist) |
| `docs/01_concept.md` | Science, precedents, why DeCodon |
| `docs/02_json_contract.md` | Frozen frontend↔backend data contract |
| `docs/03_implementation.md` | Tiered build guide |
| `docs/05_deployment.md` | Hosting details |

## Ground truth

Every design choice is backed by measurement on the actual model (see `evidence/`):

- DeCodon's codon signal is **real** (+0.43 nats over fair prior), not input echo
- Layer axis is **earned**: organism at L1, position at ~L7, amino acid at L9→L12
- Organism-switch demo uses real per-position shifts (strongest default comparison: displayed codon 39 / internal index 38) and shows observed-AA support in both conditions

## License

MIT — model weights subject to [DeCodon-200M license](https://huggingface.co/goodarzilab/decodon-200M).
