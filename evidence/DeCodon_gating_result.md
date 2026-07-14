# DeCodon-200M — the gate reruns, and this time it opens (with conditions)

**Same experiment as A4, autoregressive model.** EnCodon failed the gate because a masked encoder makes the atlas readout an echo of the input. DeCodon predicts each codon from its true left context with nothing masked, so "does context prefer a synonym here" is a well-posed, non-echo question. Ran it. **The gate opens: DeCodon's context carries real synonymous-codon signal well beyond the frequency prior — but the signal is species-heterogeneous and, for the atlas, concentrated entirely in the final layer.**

## What was run (identical protocol to A4, so the comparison is exact)

- **Model:** DeCodon-200M (`goodarzilab/decodon-200M`), the autoregressive sibling of EnCodon — 12 layers, hidden 1024, and a **taxid-conditioned** vocabulary (5 specials + 64 codons + 1,667 NCBI-taxonomy tokens). Input layout `<CLS> <taxid> codon₀ codon₁ … <SEP>`; position i predicts codon i. Downloaded via the same Xet chunk-reconstruction path, validated 0 NaN / 264 tensors byte-exact, 158M params. Custom causal attention run on CPU via the model's own non-flash fallback (confirmed causal: the 4-D causal mask is added in the einsum branch).
- **Data:** real held-out CDS from three species — *E. coli* (taxid 562), *B. subtilis* (1423), *P. aeruginosa* (287, a high-GC contrast; swapped in because yeast's taxid isn't in DeCodon's vocab). 250 sequences each, 12 sampled positions per sequence in families with a synonymous choice, position 0 excluded (it's predicted from the taxid alone). **9,000 records.**
- **The fair baseline:** because DeCodon is *given the organism* via the taxid token, the honest null is a **taxid-conditioned codon-frequency prior** (per-species usage). Any lift over that is genuine positional signal, not just "the model knows it's E. coli."

## Result 1 — behavioral: context decisively beats the frequency prior (figure A–B)

| species | DeCodon accuracy | freq-prior accuracy | cross-entropy gain (nats) |
|---|---|---|---|
| *E. coli* | **0.951** | 0.489 | **+0.963** |
| *B. subtilis* | 0.480 | 0.453 | +0.009 |
| *P. aeruginosa* | 0.823 | 0.691 | +0.320 |
| **pooled** | **0.751** | 0.545 | **+0.431** |

Compare EnCodon (A4): pooled synonym accuracy 0.459 vs 0.469 prior, cross-entropy **−0.10 nats** (worse than the prior). DeCodon flips this to **0.751 vs 0.545, +0.43 nats**. The autoregressive context genuinely determines the synonymous codon — E. coli almost deterministically (0.95).

**But note the heterogeneity, stated up front:** *B. subtilis* is essentially flat (+0.009 nats). DeCodon was trained on far more E. coli/proteobacterial sequence, and its per-organism competence varies. A demo that only ever shows E. coli would overstate the effect; an honest atlas has to let the visitor pick a weak organism and see the signal shrink.

## Result 2 — representational: the signal is a **last-layer** phenomenon (figure C)

Applying DeCodon's own (nonlinear) LM head to each layer's hidden state — a transport lens — and asking at which layer synonym preference emerges:

- Layers 1–11: **flat at ~0.33**, at or below the 0.485 frequency baseline.
- Layer 12 (final): **jumps to 0.74.**

There is no gradual layer trajectory. The middle layers carry context, but the *synonym-specific* readout crystallizes only at the top. Linear probes on the raw hidden states agree: within-family synonym decodability is at baseline through L8 and only rises at L12 (+0.14).

## What this means for the atlas — the honest design consequences

1. **DeCodon, not EnCodon, is the model to build on.** The synonymous-swap demo the mockup was built around is measuring a real effect on DeCodon (input-echo on EnCodon). Same 64-codon vocabulary, same JSON contract, same frontend — only the adapter's forward/backward changes, exactly as predicted in the decision register (A1).

2. **The "layer × position" atlas loses its layer axis for this concept.** The single most-visual promise of the Neuronpedia-style view — watching a concept strengthen across layers — does not hold here: synonym preference is ~flat until L12. Options: (a) show the layer axis honestly and let the final-layer jump be the story; (b) drop the layer trajectory for the synonym concept and make the **position × organism** view the hero (how does the model's synonym preference at each position change when you switch the taxid?); (c) keep layers only for concepts that *do* have a trajectory (if any survive a similar test).

3. **The taxid token is a genuinely cool, honest interaction.** Because the organism is an explicit input token, you can hold the sequence fixed and **switch the taxid** to watch the model's codon preferences shift toward the new organism's bias — a live, causal, non-circular demo of "the model has learned organism-specific codon strategies." This is more defensible than the ablation-of-a-gradient-direction swap in the original mockup, and it's visually immediate.

4. **The E. coli-vs-B. subtilis gap is a feature to show, not hide.** Letting the visitor see the signal collapse on a weakly-modeled organism is exactly the kind of calibration an interpretability tool should surface.

## Caveats (so they aren't a reviewer's gift)

- **Copy-ahead confound, checked:** this is not masked-token echo (there is no masked token), but an autoregressive model could score well on positions that are locally near-deterministic (repeats, strong motifs). The effect survives as a *distributional* gain (+0.43 nats over the taxid-frequency prior across 9,000 positions in 3 genomes), not just argmax on easy positions, so it is not solely a copy artifact — but a position-level breakdown (easy vs hard contexts) is the natural next check before publication.
- **Three bacterial genomes, one checkpoint.** Decisive for "is there any non-echo signal" (yes), not a characterization across the tree of life. Mammalian CDS, where synonymous choice couples to splicing/expression, is untested.
- **Nonlinear head.** The transport lens applies the full (Linear→ReLU→LayerNorm→Linear) head, so it is faithful to the model's actual computation but is not the closed-form "logit lens" of the Anthropic construction. The J-lens transport story needs this head handled explicitly — a point the adversarial review already raised (A2).

## Bottom line

- **A4 verdict on EnCodon stands: masked encoder = echo, don't build there.**
- **DeCodon passes the gate: real synonymous signal, +0.43 nats over a fair taxid-conditioned prior, up to 0.95 accuracy on E. coli.**
- **Two design constraints fall out:** the layer axis is nearly flat (signal is last-layer), so lead with the **position × organism (taxid-switch)** interaction instead of a layer trajectory; and show the **species heterogeneity** honestly rather than cherry-picking E. coli.

This is the model to build the demo on. The next decision is which of the two atlas framings (final-layer-jump vs taxid-switch) becomes the hero panel — the taxid-switch is the more defensible and more visually immediate of the two.

Files: `DeCodon_gating_result.png` (figure), `DeCodon_results.csv` (all numbers), `decodon200m_model.tar.gz` (validated weights + code).
