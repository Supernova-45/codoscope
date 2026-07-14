# Codoscope

**Bio J-Space atlas** — an interactive website visualizing what [DeCodon-200M](https://huggingface.co/goodarzilab/decodon-200M) is poised to output across a coding sequence. A biological adaptation of [Anthropic's Jacobian lens](https://transformer-circuits.pub/2026/jacobian-lens/index.html) applied to codon language models.

**Live demo:** [https://supernova-45.github.io/codoscope/](https://supernova-45.github.io/codoscope/)

## The idea

At every codon position, DeCodon's output decomposes into two legible parts:

- **Amino acid readout** — which protein is being written (high signal, coding-driven)
- **Synonymous codon readout** — which codon within that amino acid (organism-specific dialect)

**The hero interaction:** hold the sequence fixed, switch organism, and watch synonymous preferences shift while the amino acid stays put — a live visualization of codon usage bias.

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:5173/codoscope/ — the app loads real DeCodon output from `public/data/atlas_fixture.json` (60-codon *E. coli* gene × 3 organisms).

## Build & deploy

```bash
npm run build    # outputs to dist/
```

GitHub Pages deploys automatically on push to `main` via `.github/workflows/deploy.yml`.

**Before first deploy:** enable GitHub Pages → Settings → Pages → Source: **GitHub Actions**.

## Tier 1 — live inference backend

```bash
# Extract model weights (not in repo — download separately)
tar -xzf decodon200m_model.tar.gz -C ./

# Python backend
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Set `VITE_API_URL=http://localhost:8000` when building the frontend for live mode.

## Project structure

```
codoscope/
├── public/data/          # atlas_fixture.json (real DeCodon output)
├── src/                  # React + TypeScript frontend
├── adapter/              # DeCodon → JSON contract adapter
├── backend/              # FastAPI Tier 1 server
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
- Organism-switch demo uses real per-position shifts (e.g. Arg: E. coli CGC 0.96 → B. subtilis CGT)

## License

MIT — model weights subject to [DeCodon-200M license](https://huggingface.co/goodarzilab/decodon-200M).
