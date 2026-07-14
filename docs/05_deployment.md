# Deployment — GitHub + hosting

## Repository

Commit the whole app to a GitHub repo. Suggested layout:

```
biojspace/                     ← repo root
├── public/data/               ← atlas_fixture.json, concept_layers.json (copied from this handoff's data/)
├── src/                       ← React + TypeScript app
├── adapter/                   ← decodon_adapter.py + schema.json (backend, Tier 1)
├── docs/                      ← copy this handoff's docs/ for provenance
├── package.json
├── vite.config.ts
└── .github/workflows/deploy.yml
```

Commit `docs/` and `adapter/` alongside the app so the reasoning travels with the code. Do **not** commit `decodon200m_model.tar.gz` (587 MB — exceeds GitHub's file limit and isn't needed for the static site); keep it as a release asset or external download, referenced from the README.

## Hosting the static site (Tier 0) — GitHub Pages

Tier 0 is a pure static SPA (React build + the JSON fixtures), so **GitHub Pages is a good fit and free**. It serves the compiled `dist/` and the `public/data/*.json` with no server.

Two Vite specifics that will bite if skipped:
1. **Base path.** A project page is served from `https://<user>.github.io/<repo>/`, not root. Set `base: '/<repo>/'` in `vite.config.ts`, or the JS/CSS/data URLs 404.
2. **Fetch paths must respect the base.** Load the fixture via `import.meta.env.BASE_URL + 'data/atlas_fixture.json'`, not an absolute `/data/...`.

Deploy via GitHub Actions (`.github/workflows/deploy.yml`): on push to `main`, `npm ci && npm run build`, then publish `dist/` with `actions/deploy-pages`. Enable Pages → "GitHub Actions" as the source in repo settings. That's the entire pipeline; no secrets needed.

## Hosting Tier 1 (live inference) — NOT GitHub Pages

The moment you add the FastAPI backend that runs DeCodon, you need a server — **GitHub Pages cannot run Python**. Keep the frontend on Pages and host the backend separately:

- **Backend options** (CPU is enough — DeCodon-200M runs ~0.3 s/forward on CPU): a small always-on box (Render, Railway, Fly.io, or a plain VM), or a serverless container if cold-start latency is acceptable. InterProt uses RunPod serverless for its ESM-2 backend; that pattern works but is optimized for GPU — you don't need a GPU here.
- **CORS:** the Pages origin (`https://<user>.github.io`) must be allow-listed in the FastAPI app, or the browser blocks the cross-origin POST.
- **Config:** the frontend reads the backend URL from an env var at build time (`VITE_API_URL`); Pages build injects the deployed backend URL.

**Recommendation:** ship Tier 0 to GitHub Pages first as the public demo (it's the honest, self-contained MVP and needs no infrastructure). Add the Tier-1 backend only when live paste-your-own-sequence is worth the hosting cost, and keep the two deployments decoupled — the frozen JSON contract means the Pages frontend doesn't care whether the JSON came from the committed fixture or a live backend.
