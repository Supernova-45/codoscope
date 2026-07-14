# Codoscope

**Bio J-Space atlas** — an interactive website visualizing what [DeCodon-200M](https://huggingface.co/goodarzilab/decodon-200M) is poised to output across a coding sequence. It adapts the output-accessible perspective of [Anthropic's Jacobian lens](https://transformer-circuits.pub/2026/jacobian-lens/index.html) to a codon language model.

**Live demo:** [https://supernova-45.github.io/codoscope/](https://supernova-45.github.io/codoscope/)

## The idea

At every codon position, DeCodon's output decomposes into two legible parts:

- **Amino acid readout** — which protein is being written (high signal, coding-driven)
- **Synonymous codon readout** — which codon within that amino acid (organism-specific dialect)

**The hero interaction:** hold the sequence fixed, switch organism, and watch synonymous preferences shift while the amino acid stays put — a live visualization of codon usage bias.

### Scope and scientific claim

The position view decomposes actual DeCodon output probabilities. The vertical layer view uses independently measured linear-probe trajectories from the evidence package. It does **not** invent a per-layer synonym trajectory: the measured synonym signal crystallizes at L12, so organism comparison is the honest view of that signal.

The current atlas is J-lens-inspired output analysis, not a claim that the fixture contains a per-position residual-to-output Jacobian.

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
python -m unittest discover -s backend -p "test_*.py"
```

## Build & deploy

```bash
npm run build    # outputs to dist/
```

GitHub Pages deploys automatically on push to `main` via `.github/workflows/deploy.yml`.
The workflow validates the frontend, builds it with the correct `/codoscope/` base path, enables Pages when permissions allow, and uploads `dist/`.

## Tier 1 — live inference backend

```bash
# Download or extract the model to ./decodon_model
export DECODON_MODEL_DIR="$PWD/decodon_model"

# Python backend
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Set `VITE_API_URL=http://localhost:8000` when building the frontend for live mode.

The API exposes:

- `GET /api/health` — service/model readiness
- `GET /api/organisms?query=coli` — supported model taxids with NCBI names
- `POST /api/atlas` — validated CDS + up to five taxids → frozen atlas contract
- `GET /api/docs` — OpenAPI documentation

### Container deployment

`backend/Dockerfile` runs a single CPU model worker and downloads
`goodarzilab/decodon-200M` into a persistent model directory on first boot.
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

## Project structure

```
codoscope/
├── public/data/          # atlas_fixture.json (real DeCodon output)
├── src/                  # React + TypeScript frontend
├── adapter/              # DeCodon → JSON contract adapter
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
- Organism-switch demo uses real per-position shifts (strongest fixture example: Arg at position 38)

## License

MIT — model weights subject to [DeCodon-200M license](https://huggingface.co/goodarzilab/decodon-200M).
