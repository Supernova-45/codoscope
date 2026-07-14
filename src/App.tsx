import { useEffect } from 'react';
import { useAtlasStore } from './store/atlasStore';
import { SequenceStrip } from './components/SequenceStrip';
import { OrganismSwitch } from './components/OrganismSwitch';
import { ReadoutPanel } from './components/ReadoutPanel';
import { LayerPanel } from './components/LayerPanel';
import { SequenceInput } from './components/SequenceInput';

export default function App() {
  const loadFixture = useAtlasStore((s) => s.loadFixture);
  const loading = useAtlasStore((s) => s.loading);
  const error = useAtlasStore((s) => s.error);
  const document = useAtlasStore((s) => s.document);

  useEffect(() => {
    loadFixture();
  }, [loadFixture]);

  return (
    <div className="app">
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <h1>Codoscope</h1>
            <p className="tagline">Bio J-Space atlas for DeCodon-200M</p>
          </div>
          <nav className="header-links">
            <a href="https://transformer-circuits.pub/2026/jacobian-lens/index.html" target="_blank" rel="noreferrer">
              J-lens paper
            </a>
            <a href="https://huggingface.co/goodarzilab/decodon-200M" target="_blank" rel="noreferrer">
              DeCodon model
            </a>
            <a href="https://github.com/supernova-45/codoscope" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {loading && !document && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading atlas fixture…</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button type="button" onClick={() => loadFixture()}>Retry</button>
          </div>
        )}

        {document && (
          <>
            <section className="intro-banner">
              <p>
                Visualize what <strong>DeCodon-200M</strong> is poised to output across a coding sequence —
                a biological adaptation of Anthropic&apos;s Jacobian lens. Switch organism and watch synonymous
                codon preferences shift while the amino acid stays fixed.
              </p>
            </section>

            <SequenceInput />
            <OrganismSwitch />
            <SequenceStrip />
            <ReadoutPanel />
            <LayerPanel />

            <footer className="site-footer">
              <p>
                Model: {document.model.name} · {document.model.n_layers} layers ·
                Schema {document.schema_version}
              </p>
              <p className="footer-note">
                Fixture data is real DeCodon output on an <em>E. coli</em> gene run under three organisms.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
