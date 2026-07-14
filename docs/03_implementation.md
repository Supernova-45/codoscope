# BioJ-Space — implementation guide for a coding agent

You are building an interactive web app that visualizes what **DeCodon-200M** is poised to output across a coding sequence, layer by layer, with an organism-switch as the signature interaction. Read `docs/01_concept.md` (why) and `docs/02_json_contract.md` (the data shape) first. This doc is *how*.

> **If you are not a biologist, read `docs/00_biology_primer.md` before this.** Several data invariants and design decisions in this guide come from molecular biology, not engineering taste — the primer explains each one and flags the "ask, don't guess" points. Wrong biological assumptions produce output that renders fine and is scientifically empty.

**Guiding principle: decouple the two halves.** The frontend renders a frozen JSON document (`data/atlas_fixture.json`) and knows nothing about PyTorch. The backend emits that document and knows nothing about React. Build them against the fixture in parallel. The fixture is **real DeCodon output**, not mock data — if the frontend looks good on it, it looks good on live data.

Ship in tiers. Each tier is a working product; do not start the next until the current one runs.

---

## Tier 0 — static atlas against the fixture (days, no GPU, the honest MVP)

**Goal:** the full visual experience, driven entirely by `data/atlas_fixture.json`. No backend, no model. This is deployable to any static host and is the thing to show first.

### Stack
- **React + TypeScript + Vite.** (InterProt, your closest product analog, is React — study `github.com/etowahadams/interprot` for UX patterns.)
- **Visualization: plain SVG or `d3` for the atlas grid**; the grid is small (positions × concepts), so you do not need a canvas/WebGL layer at Tier 0. Reach for canvas only if a sequence exceeds ~500 positions.
- **State:** a single store (Zustand or React context) holding `{document, selectedOrganism, selectedPosition, pinnedConcepts, hoveredLayer}`.
- No server. `fetch('/data/atlas_fixture.json')` at load.

### The four views (build in this order)

**1. Sequence strip (x-axis).** Horizontal track of codon boxes from `tokens[]`. Each box shows the codon (mono font) with the amino acid above it (`aa3`). This is the spine every other view aligns to. Color the box background by amino-acid chemical class (hydrophobic/polar/positive/negative) — a stable, meaningful palette, colorblind-safe.

**2. The readout panel (click a position).** On selecting position `p`, show the two-part readout from `per_organism[selectedOrganism][p]`:
   - **Amino-acid-mean** (`aa_readout`) as a small horizontal bar list ("what protein"): Ala 0.71, Gly 0.11, ...
   - **Synonymous-residual** (`synonym_readout`) as a second bar list ("which codon"): GCG 0.66, GCC 0.13, ...
   - A confidence chip (`aa_confidence`) and the synonym entropy (`synonym_entropy`) as a small gauge (0 = committed, 1 = flat).
   - **Every chip renders from `{label, kind}`** — never assume a bare string. Color by `kind` (aa_mean vs codon get distinct hues); this is what lets you drop in `sae`/`phenotype` chips later without a rewrite.

**3. The organism switch (THE HERO — make this excellent).** A prominent control (segmented buttons or a dropdown) over `organisms[]`. On change, **animate** the readout panel and the atlas: the `synonym_readout` bars should visibly slide/re-rank while the `aa_readout` bars stay put. That contrast — synonyms move, amino acid doesn't — *is the scientific story*, so the animation is not decoration, it's the message. Add a "compare organisms" mode that shows two organisms' `synonym_readout` for the selected position side by side (the fixture's Arg-CGC→CGT shift is a ready-made highlight). Consider a subtle "Δ" badge on positions whose top synonym changes across the currently-compared organisms.

**4. The layer axis (y-axis) — render it HONESTLY from `concept_layers`.** This is where most Neuronpedia clones lie; you won't. Draw a small multiples panel or a single line chart of `concept_layers.concepts[*].scores` across layers, with each concept a line and its `baseline` a dotted reference. Annotate the three depth regimes measured in this model:
   - **organism** — high from layer 1 (it's an input token),
   - **relative position in CDS** — mid-layer bump (~L7),
   - **amino-acid identity/class** — late buildup (L9→L12).
   Let the user hover a layer to highlight it. **Do not animate a synonym concept "building" across layers** — it doesn't (it's an L12 jump); that's what the organism switch is for. A one-line caption should say "different biology resolves at different depths."

### Tier-0 done =
paste-free (fixture auto-loads), click any position → two-part readout, switch organism → synonyms animate, layer panel shows the honest depth story. **Deploy to GitHub Pages** — Tier 0 is pure static (React build + JSON fixtures), so Pages hosts it free with no backend. See `docs/05_deployment.md` for the repo layout, the Vite `base` path gotcha, and the Actions workflow.

---

## Tier 1 — live single-sequence inference (weeks, CPU-servable)

**Goal:** a text box where the user pastes their own CDS and picks organisms; the app runs DeCodon and renders the same views.

### Backend
- **FastAPI** (Python) wrapping `adapter/decodon_adapter.py`. One endpoint:
  `POST /api/atlas` with `{sequence: "ATG...", organisms: [562, 1423, ...]}` → returns a contract document.
- **Model loading:** DeCodon-200M is 158M params, runs on CPU in this project (~0.3 s per sequence forward). Load once at server start (see adapter gotchas: `use_flash_attn=False`, the einsum patch). Extract the weights from `decodon200m_model.tar.gz` (shipped in this handoff, already validated NaN-free) into `./decodon_model`.
- **Validation before inference:** reject sequences that aren't clean CDS (not `ATG`-start, length not `% 3`, internal stop, non-ACGT) with a clear error — the model's readout is only meaningful on real coding frames. Reject taxids not in the vocab (`"<taxid>" in vocab`) and return the list of supported organisms.
- **Guardrails:** cap sequence length (e.g. 512 codons) and organism count per request; the forward cost is linear in both.

### Frontend delta
- Add a paste box + organism multiselect (populate from a `GET /api/organisms` that returns the vocab's taxid tokens with human names — resolve names via NCBI Taxonomy once, cache).
- Swap the fixture fetch for the POST. Everything else (Tier 0 views) is unchanged — that's the payoff of freezing the contract.
- Stream nothing yet; a single forward is fast enough to return synchronously.

---

## Tier 2 — the richer, "cool" layer (optional, in priority order)

Only after Tier 1 is solid. Each of these is independent; pick by appetite.

1. **The represented-vs-accessible two-panel (the one genuinely novel comparison).** Add a second panel driven by an SAE trained on DeCodon hidden states, so the user sees, on the *same* codon sequence: what the model **represents** (SAE features, `kind:"sae"`) next to what it's **poised to output** (the J-lens readout you already have). This is the comparison the novelty scan found unclaimed (see `evidence/BioJSpace_novelty_scan.md`). Train a small top-k SAE on layer-8–12 activations from a few thousand CDS; expose its top features per position as `sae` chips. This is the single most defensible "wow" addition because no existing tool shows both axes on one bio sequence.
2. **Genome-browser tracks.** Under the sequence strip, add aligned tracks: GC content, `aa_confidence`, `synonym_entropy`, secondary-structure prediction if you have it. Borrow the *idea* (not code) from Evo 2's visualizer of overlaying features on annotations. Keep tracks as `kind:"derived"` readouts so they flow through the same contract.
3. **Intervention / steering.** Let the user force a synonymous swap at a position and re-run downstream (autoregressive, so a swap changes later predictions) — show the delta. This replaces the mockup's ablation demo with a causally honest one: you're changing an *input codon*, not ablating a gradient direction.
4. **Full Neuronpedia fork.** Only if you want persistence, auto-interp, and a feature database. `github.com/neuronpedia/jacobian-lens` is the reusable frontend; forking it is a Tier-2+ commitment (Postgres, autointerp pipelines) far beyond this demo's needs. For a showcase, Tier 0–1 plus the SAE panel is more impressive per unit effort.

---

## What to build first, concretely

1. Stand up Vite+React, drop `data/atlas_fixture.json` in `public/data/`, render the **sequence strip** (view 1).
2. Add the **readout panel** (view 2) — click a position, see the two bar lists.
3. Add the **organism switch** (view 3) with the synonyms-animate-amino-acid-doesn't transition. This is the demo; make it feel good.
4. Add the **layer panel** (view 4) from `concept_layers`.
5. That is a complete, honest, deployable Tier 0. Then wrap the adapter in FastAPI for Tier 1.

Do not skip to a backend. The fixture is real model output; a frontend that shines on it is the product.
