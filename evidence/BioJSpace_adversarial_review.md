# Adversarial review: *BioJ-Space / CodonLens* planning brief

**Reviewer stance:** the brief was written to be stress-tested by another AI (§9 is a copy/paste brief for exactly that). This review does not summarize it — it attacks it. I take each load-bearing claim, state what would have to be true for it to hold, and show where it breaks. Verified facts are separated from the author's assertions throughout.

**One-line verdict:** the *product* (an interactive layer×position atlas modeled on Neuronpedia's J-lens viewer) is buildable. The *scientific premise that makes it worth building* — that a CodonFM "J-space" reveals a rich, workspace-like geometry of biology — is not supported, and two of its three central analogies to the Anthropic paper break at the point where they carry the argument. The brief's own best model choice is undercut by its own math, and a better-matched model (an autoregressive codon decoder) is sitting in the same code release, unmentioned.

---

## 0. What I verified independently (so the critique isn't itself hand-waving)

| Claim in brief | Status | Basis |
|---|---|---|
| Anthropic J-lens paper exists; sparse nonnegative k≈25 token dictionary, verbalizability | **True** | transformer-circuits.pub 2026 + `anthropics/jacobian-lens` repo |
| CodonFM / EnCodon is a real codon-resolution transformer **encoder**, checkpoints released | **True** | `goodarzilab/encodon-80M`, `nvidia/NV-CodonFM-Encodon-{600M,1B}` on HF |
| Neuronpedia ships a reusable Jacobian-lens frontend | **True** | `neuronpedia/jacobian-lens` (HF), pushed ~1 week ago |
| "64 native codon directions vs 1,024–2,048 hidden dims → undercomplete" | **True, and worse than stated** | computed below |
| CodonFM has *only* a masked bidirectional formulation to offer | **False** | the same lab ships `goodarzilab/decodon-200M`, an **autoregressive** codon model |

The factual scaffolding is sound. The problems are in the reasoning built on top of it.

---

## 1. The fatal structural problem: the "biological groupings" are a change of basis, not new information

The brief concedes the native dictionary is undercomplete (§4.1) but treats it as a *visual* nuisance — "scientifically clean but visually repetitive unless it is grouped or augmented" (§1). It then proposes (§4.2) to rescue richness by deriving amino-acid means, synonymous residuals, GC3 contrasts, stop directions, etc. from the 64 codon directions.

**This does not add information, and the genetic code proves it exactly.** Decomposing the standard code:

- 20 amino-acid families + 1 stop family = **21 amino-acid-mean directions**
- within-family synonymous residuals contribute exactly **41 dimensions** across the 20 AA families (a family of size *n* has *n−1* residual dimensions)
- stop residuals contribute **2**
- **21 + 41 + 2 = 64** — i.e. exactly the rank of the original codon dictionary.

The "grouped biological axes" are an orthogonalized relabeling of the *same 64 vectors*. They cannot reveal anything the 64 codon logit-gradients don't already contain; they only make the low-rank slice easier to name. And that slice is tiny: **64 directions span at most 64/1024 ≈ 6.2% (80M/600M) or 64/2048 ≈ 3.1% (1B) of the hidden state.** Two amino acids (Met, Trp) have *zero* synonymous residual, so for those positions the entire "synonym preference" apparatus is empty by construction.

**Why this is the whole ballgame:** Anthropic's result is *about* an **overcomplete** dictionary — tens of thousands of token directions in a few-thousand-dim space, so that "which few concepts are active at layer *l*, position *t*?" is a genuine sparse-coding question with a non-trivial answer. The brief's §3.2 table even flags this as the one row where the analogy inverts ("Unlike Anthropic, the dictionary is not overcomplete") and then walks past it. With an **undercomplete, ≤64-atom** dictionary, sparse nonnegative decomposition with k≈25 is nearly degenerate: you are choosing ~25 of ~64 atoms to reconstruct a projection that lives in a ≤63-dim subspace. The signature phenomenon of the parent paper — a sparse, selective, workspace-like *code* — has no room to exist in the native CodonFM readout. The atlas will be legible and largely predetermined by the input codon, which is what Figure 2's mockup already shows (row L1 literally just re-prints the input codons).

The brief's own escape hatch — "augment with SAE / motif / phenotype / assay directions" — is the tell. The moment you augment, you are no longer doing the CodonFM J-space that the whole memo is built around; you are doing SAEs on a codon model (InterPLM-style, ref [9,10]), which is a different, already-populated project.

## 2. The load-bearing analogy — "verbalizable → output-accessible" — changes the meaning of the result

Anthropic's "verbalizable / global workspace" claim is inseparable from **autoregressive future-token** structure: a direction is in the workspace if perturbing it tends to make the model *say the concept later*, across future positions. The workspace framing is a claim about a **limited-capacity serial bottleneck that broadcasts forward**.

CodonFM/EnCodon is a **bidirectional masked encoder.** There is no "later." Masked-codon prediction reconstructs a hidden position from its two-sided context; the logit gradient measures "which hidden directions change *this* reconstruction," not "which directions are broadcast to downstream computation." Renaming "verbalizable" to "output-accessible" (§2.1, §3.2 bottom row) papers over a change in the referent:

- Anthropic: *does this direction propagate to future outputs?* (a transport question)
- Brief's MLM version: *does this direction change the masked logit here?* (a local saliency question)

These are not the same quantity, and only the first supports "workspace." Consequently **§4.5 ("possible evidence of a workspace-like regime") is looking for a phenomenon whose defining mechanism — serial forward broadcast — is architecturally absent from an encoder.** "The same direction transfers across genes/taxa" and "only a limited layer band dominates" can both be true of an encoder without anything workspace-like being present; they'd be evidence of *shared low-rank structure*, which an undercomplete dictionary guarantees anyway (see §1). The claim-discipline table (§2.3) is admirable, but it polices the word "conscious" while letting "workspace-like" through under a "Conditional" label — and workspace-like is precisely the load-bearing overclaim.

**The sharp irony:** the model that *would* match Anthropic's construction — autoregressive, present→future, real broadcast — is `goodarzilab/decodon-200M`, shipped in the *same* `cdsFM` repo. The brief lists "autoregressive future-output causality" as the virtue of Evo 2 / HyenaDNA / ProGen2 (§7.3) while centering the one CodonFM variant that lacks it, and never mentions DeCodon. If the genetic-code equivalence-class story is the crown jewel, DeCodon buys it *with* the causal structure the brief keeps saying it wants.

## 3. Neither proposed "J-lens" is actually a lens once the head is nonlinear

Anthropic's lens is a *lens* because the transported state passes through an (approximately) **fixed linear** unembed `W_U`, giving one stable direction per token. The brief admits (§3.3) CodonFM's MLM head is nonlinear and offers two variants — and both quietly abandon the property that makes a lens a lens:

- **Transport-first:** apply the real nonlinear head to `J_l h`. The brief concedes the codon "directions are not globally fixed." Then it is not a dictionary of directions at all — it is a per-input Jacobian-vector product, i.e. Grad-CAM with extra transport. You cannot do sparse decomposition, steering, or swaps against a dictionary that moves with every input.
- **Average logit-gradient:** `v(l,c) = E[∂z(j,c)/∂h(l,i)]`. This fixes the direction by **averaging saliency maps over contexts.** Averaged gradients are a known-weak causal object: the averaging destroys exactly the context-dependence that the "context-influence view" (§4.3) and the layer trajectories (Fig 2) claim to display. You get one blurred vector per codon per layer and then present per-position variation that the vector, by construction, averaged away.

Presenting these as "both mathematically valid adaptations" with a "tradeoff" understates it: the parent method's validity rests on a linear readout, and CodonFM doesn't have one. This is a difference in kind (lens vs. input-gradient attribution), not a tradeoff in fidelity.

## 4. The flagship causal experiment is circular

§4.4 / §8.1: build `v_GCG_residual = v_GCG − v_Ala`, ablate/swap it, and measure "selective shift among alanine synonyms with minimal off-target change." The proposed selectivity metric is *target synonym shift / off-target change* (§8.2).

The intervention direction **is defined as the gradient of the very logit it is then measured against.** Ablating along `v_GCG` is guaranteed to move `z(·,GCG)` — you engineered the axis from that derivative. A high selectivity score is therefore close to a tautology, not evidence of a privileged biological mechanism. To make it a real test you need the effect on quantities *not* used to construct the direction — held-out phenotype heads, downstream expression, translation measurements — and matched **null directions** (random norm-matched, and GC-matched non-synonymous). The brief lists these controls (§8.3, to its credit) but the headline "selective synonym swap" figure will look impressive for reasons that have nothing to do with biology, and a casual reader (or a demo) won't distinguish the two.

There is a second confound specific to MLMs: at an **unmasked** position the codon logit is dominated by that position's own input embedding, so "preference" is near-copying; at a **masked** position it is the model's prior. "Preference beyond the encoded amino acid" is only well-defined under a masking protocol the brief leaves as a free parameter (`mask_strategy: selected|random|pseudo-likelihood`, §5.2) — and the answer to "is there synonym structure?" can be manufactured by choosing it.

## 5. Enformer is smuggled into a menu it doesn't belong in

Enformer recurs as a top candidate (Fig 3: 4.3, second place) and is repeatedly qualified as "not a language model; assay-accessible rather than token-accessible" (§6, §7.1, §7.4). That qualifier is the whole objection: Enformer has no residual-stream→unembed transport and no autoregressive/masked output distribution. A "Jacobian" from a hidden layer to its 5,313-track head is ordinary input attribution, which people already compute routinely. Including it inflates the model menu and lets the brief claim breadth ("token-accessible vs assay-accessible J-spaces") that the underlying method doesn't actually span. It's a different project wearing the same name.

## 6. The quantitative ranking (Figure 3) is motivated reasoning with false precision

The bar chart reports one-decimal "project-fit" scores (CodonFM 4.6, Enformer 4.3, ProGen2 4.0 …) that the caption itself calls "illustrative." They are invented numbers, and the weighting axis — "clean biological question, native label interpretability, causal tests, open implementation, web-demo value" — is exactly the profile on which the author's preferred model wins. The criteria are back-fit to the conclusion, then rendered as a precise ranking. Either run a real scoring rubric with pre-registered weights, or drop the numbers; as drawn, the figure lends spurious rigor to a foregone preference. (And per §1–§2, on the two criteria that actually matter for *this* method — dictionary richness and causal/future-output structure — CodonFM-Encodon is arguably the *worst* transformer choice on the list, not the best.)

## 7. "Novelty" is a one-week head start, not a gap

§6 / §6.1: "I did not identify a published study applying the Jacobian lens specifically to CodonFM." The J-lens paper is dated 2026 and the Neuronpedia frontend was pushed ~a week before this brief. "Nobody has applied a week-old method to model X" is a race condition, not a research gap — it will be false for many (model, method) pairs within weeks, and it provides no evidence the combination is *fruitful*. The durable novelty candidates the brief lists (synonymous residual swaps; represented-vs-output-accessible comparison) are real ideas, but the first is a standard activation-patching / causal-mediation experiment that needs none of the J-lens machinery, and the second reduces to "SAE features vs. logit-gradient directions," a comparison you can run in a notebook without a website.

## 8. Scope inversion: a Next.js/Postgres/PyTorch platform proposed before a single figure exists

§5 proposes forking Neuronpedia's full stack (React + PostgreSQL + PyTorch serving + NDJSON streaming + steering + sharing + feature pages) — §8.4 even lists a "live inference explorer." None of the §1–§4 scientific questions are settled. The correct ordering is inverted: the honest MVP is a **static notebook** that (a) fits the average logit-gradient dictionary on EnCodon-80M, (b) checks whether middle layers carry *any* synonymous-residual structure beyond input identity, and (c) runs the swap experiment against held-out heads with null controls. That is one or two figures, and it is the gating result. If it's null — which §1 predicts for the native dictionary — the entire web platform is moot. Building the cathedral first converts a cheap falsification into an expensive one.

## 9. Compute realism is unaddressed

The Jacobian `∂h_final,t' / ∂h_l,t` for a bidirectional encoder is a hidden×hidden object per (layer, source, target) triple; the honest estimator needs either *d* backward passes or JVP/HVP machinery, averaged over 100–500 sequences of 256–512 codons. On the **80M** checkpoint this is fine; the brief repeatedly invokes the **1B** checkpoint (§1, §7.1) as if it were free. No memory/throughput budget appears anywhere. Given §1 says the extra scale buys you a *smaller* fraction of representable directions in the native dictionary, the 1B model is the wrong place to spend compute for this specific method.

---

## What survives (steelman — where the brief is right)

- **The engineering reuse is real.** Neuronpedia's J-lens frontend exists and is forkable; the layer×position interaction model transfers to sequences cleanly. As a *visualization engineering* project, it's tractable and the Figure 2 mockup is good.
- **The claim-discipline table (§2.3) and the confound caveat (§6.2) are genuinely careful** — the brief itself names the correlation-vs-causation trap and the GC/taxonomy shortcut risk. The problem is that the headline framing (workspace, J-space, model ranking) doesn't live up to the discipline the fine print asks for.
- **The synonymous equivalence class is a genuinely nice controlled-perturbation setting** — holding amino-acid identity fixed while varying codon is a real experimental affordance most sequence models don't offer. It just doesn't need "J-space" to be valuable, and it works better on the autoregressive DeCodon.
- **The "represented (SAE) vs. output-accessible (gradient)" contrast is the one idea worth keeping** and is under-developed relative to the website plumbing.

## Recommended reframing (if the project proceeds)

1. **Kill the workspace framing for the encoder.** Either (a) switch to `decodon-200M` (autoregressive) so "output-accessible → future codon" is a real transport claim, or (b) drop "workspace" and call it what it is on EnCodon: a codon-logit saliency atlas. Don't keep both the encoder and the workspace language.
2. **Pre-register the null.** State up front that the native 64-atom dictionary spans ≤6% of hidden space and that the grouped axes are a change of basis (§1). Make the *first* deliverable the test of whether middle layers carry synonymous-residual structure beyond input identity. If not, publish that — it's a clean negative result about undercomplete biological dictionaries.
3. **De-circularize the causal test.** Evaluate every intervention on quantities *not* used to build the direction (frozen expression/TE/stability heads), against random-norm and GC-matched nulls. Report selectivity only relative to those nulls.
4. **Cut Enformer** from the "J-space" menu (or relabel the project as "output-attribution atlases," which honestly covers Enformer and the LMs both).
5. **Replace Figure 3** with either a real rubric or a qualitative table. As drawn it is advocacy.
6. **Ship a notebook, not a platform,** until step 2 returns a positive.

---

*Prepared as an adversarial technical review. Factual existence claims verified against the cited repositories and model cards; the genetic-code decomposition (21 + 41 + 2 = 64) computed directly from the standard code. Where the brief is careful I've said so; the failures above are in the reasoning that connects verified facts to the headline claims, not in the facts themselves.*
