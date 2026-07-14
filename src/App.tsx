import { useEffect } from 'react';
import { useAtlasStore } from './store/atlasStore';
import { SequenceStrip } from './components/SequenceStrip';
import { OrganismSwitch } from './components/OrganismSwitch';
import { ReadoutPanel } from './components/ReadoutPanel';
import { LayerPanel } from './components/LayerPanel';
import { SequenceInput } from './components/SequenceInput';
import { ProductIntro } from './components/ProductIntro';
import { ExampleGallery } from './components/ExampleGallery';
import { GuidedTour } from './components/GuidedTour';
import { MethodBadge } from './components/MethodBadge';
import { LayerPositionAtlas } from './components/LayerPositionAtlas';

export default function App() {
  const initialize = useAtlasStore((s) => s.initialize);
  const loading = useAtlasStore((s) => s.loading);
  const error = useAtlasStore((s) => s.error);
  const document = useAtlasStore((s) => s.document);
  const liveMode = useAtlasStore((s) => s.liveMode);
  const clearError = useAtlasStore((s) => s.clearError);
  const examples = useAtlasStore((s) => s.examples);
  const selectedExampleId = useAtlasStore((s) => s.selectedExampleId);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const selectedPosition = useAtlasStore((s) => s.selectedPosition);
  const selectedLayer = useAtlasStore((s) => s.selectedLayer);
  const pinnedLabels = useAtlasStore((s) => s.pinnedLabels);
  const currentExample = examples.find((item) => item.id === selectedExampleId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!document) return;
    const params = new URLSearchParams();
    if (selectedExampleId) params.set('example', selectedExampleId);
    if (selectedOrganism) params.set('organism', selectedOrganism);
    if (compareMode && compareOrganism) params.set('compare', compareOrganism);
    if (selectedPosition !== null) params.set('position', String(selectedPosition));
    if (selectedLayer !== null) params.set('layer', String(selectedLayer));
    if (pinnedLabels.length) params.set('pins', pinnedLabels.join(','));
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [
    compareMode,
    compareOrganism,
    document,
    pinnedLabels,
    selectedExampleId,
    selectedLayer,
    selectedOrganism,
    selectedPosition,
  ]);

  return (
    <div className="app">
      <a className="skip-link" href="#atlas-content">Skip to atlas</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <h1>Codoscope</h1>
            <p className="tagline">Bio J-Space atlas for DeCodon-200M</p>
          </div>
          <nav className="header-links">
            <a href="#examples">Examples</a>
            <a href="#atlas-workspace">Atlas</a>
            <a href="#layer-evidence">Layers</a>
            <a href="#methods">Methods</a>
            <a href="https://github.com/Supernova-45/codoscope" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="main-content" id="atlas-content">
        {loading && !document && (
          <div className="loading-state" role="status">
            <div className="spinner" />
            <p>Loading atlas fixture…</p>
          </div>
        )}

        {error && !document && (
          <div className="error-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => initialize()}>Retry</button>
          </div>
        )}

        {document && (
          <>
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button type="button" onClick={clearError} aria-label="Dismiss error">×</button>
              </div>
            )}
            <ProductIntro />
            <ExampleGallery />

            <section id="atlas-workspace" className="atlas-section" aria-labelledby="atlas-title">
              <div className="section-heading atlas-heading">
                <div>
                  <span className="section-kicker">Interactive atlas</span>
                  <h2 id="atlas-title">{currentExample?.title ?? 'Explore the sequence'}</h2>
                  <p>{currentExample?.takeaway}</p>
                </div>
                <MethodBadge method={currentExample?.method ?? 'output'} />
              </div>
              <GuidedTour />
              <div className="atlas-workspace-grid">
                <div className="atlas-main-column">
                  <OrganismSwitch />
                  <SequenceStrip />
                </div>
                <aside className="atlas-inspector" aria-label="Selected position inspector">
                  <ReadoutPanel />
                </aside>
              </div>
              <LayerPositionAtlas />
              <LayerPanel />
            </section>

            <section className="own-sequence-section" aria-labelledby="own-sequence-title">
              <div className="section-heading">
                <span className="section-kicker">Bring your own biology</span>
                <h2 id="own-sequence-title">Analyze a coding sequence</h2>
                <p>The static atlas remains available even when a live model backend is not configured.</p>
              </div>
              <SequenceInput />
            </section>

            <details className="panel methodology-panel" id="methods">
              <summary>Methods, claims, and references</summary>
              <div className="methodology-content">
                <h3>What the current public examples measure</h3>
                <p>
                  The position readout decomposes DeCodon output probabilities into
                  amino-acid mass and within-family synonymous preferences. The
                  vertical chart shows independently measured linear-probe scores
                  across hidden layers.
                </p>
                <p>
                  Codoscope does not fabricate a synonym trajectory through layers:
                  the measured synonym signal crystallizes at L12. The organism
                  switch is the honest view of that signal. This output-accessible
                  atlas is inspired by the Jacobian lens; the current fixture is not
                  a per-position Jacobian computation.
                </p>
                <div className="method-key">
                  <MethodBadge method="output" />
                  <p>Final-layer model probabilities. Used for the organism-switch stories.</p>
                  <MethodBadge method="probe" />
                  <p>Independent classifiers/regressors measured across hidden layers.</p>
                  <MethodBadge method="jacobian_lens" />
                  <p>Reserved for data transported by a fitted averaged Jacobian; never used as a decorative label.</p>
                </div>
                <h3>Primary sources</h3>
                <ul className="reference-list">
                  <li>
                    <a href="https://transformer-circuits.pub/2026/workspace/index.html" target="_blank" rel="noreferrer">
                      Gurnee et al. — Verbalizable Representations Form a Global Workspace in Language Models
                    </a>
                  </li>
                  <li>
                    <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11482952/" target="_blank" rel="noreferrer">
                      Chu et al. — A Suite of Foundation Models Captures the Contextual Interplay Between Codons
                    </a>
                  </li>
                  <li>
                    <a href="https://proceedings.mlr.press/v267/adams25a.html" target="_blank" rel="noreferrer">
                      Adams et al. — InterProt and mechanistic biology with protein language models
                    </a>
                  </li>
                </ul>
              </div>
            </details>

            <footer className="site-footer">
              <p>
                Model: {document.model.name} · {document.model.n_layers} layers ·
                Schema {document.schema_version}
              </p>
              <p className="footer-note">
                {liveMode
                  ? 'Live readout generated by the configured DeCodon backend.'
                  : <>Static examples use real DeCodon output on an <em>E. coli</em> CDS run under three organisms.</>}
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
