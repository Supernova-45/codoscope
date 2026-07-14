import { useAtlasStore } from '../store/atlasStore';
import { BarList, EntropyGauge } from './BarList';

export function ReadoutPanel() {
  const document = useAtlasStore((s) => s.document);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const selectedPosition = useAtlasStore((s) => s.selectedPosition);

  if (!document || selectedPosition === null) {
    return (
      <section className="panel readout-panel empty">
        <p>Select a codon position to see the model readout.</p>
      </section>
    );
  }

  const token = document.tokens[selectedPosition];
  const readout = document.per_organism[selectedOrganism]?.[selectedPosition];
  const compareReadout = compareMode && compareOrganism
    ? document.per_organism[compareOrganism]?.[selectedPosition]
    : null;

  if (!token || !readout) return null;

  const hasSynonyms = token.aa !== 'M' && token.aa !== 'W';
  const hasSequenceContext = selectedPosition > 0;

  return (
    <section className="panel readout-panel">
      <div className="panel-header">
        <h2>Position {selectedPosition} readout</h2>
        <span className="panel-meta">
          {token.aa3} · {token.codon} · true input
        </span>
      </div>

      <div className="readout-grid">
        <div className="readout-section aa-section">
          <BarList
            title="Amino acid (what protein)"
            entries={readout.aa_readout}
            highlightLabel={readout.true_aa}
          />
          <div className="confidence-chip">
            <span>AA confidence</span>
            <strong>{(readout.aa_confidence * 100).toFixed(1)}%</strong>
          </div>
        </div>

        {!hasSequenceContext ? (
          <div className="readout-section synonym-section trivial">
            <p className="trivial-note">
              Position 0 has no upstream codon context. DeCodon predicts it from
              the organism token alone, so Codoscope excludes it from the
              synonymous analysis.
            </p>
          </div>
        ) : hasSynonyms ? (
          <div className={`readout-section synonym-section ${compareMode ? 'compare' : ''}`}>
            <BarList
              title={`Synonymous codon (${selectedOrganism})`}
              entries={readout.synonym_readout}
              highlightLabel={readout.true_codon}
            />
            {compareReadout && (
              <BarList
                title={`Synonymous codon (${compareOrganism})`}
                entries={compareReadout.synonym_readout}
                highlightLabel={compareReadout.true_codon}
              />
            )}
            <div className="entropy-stack">
              <EntropyGauge
                value={readout.synonym_entropy}
                label={`Entropy · ${selectedOrganism.split(' (')[0]}`}
              />
              {compareReadout && compareOrganism && (
                <EntropyGauge
                  value={compareReadout.synonym_entropy}
                  label={`Entropy · ${compareOrganism.split(' (')[0]}`}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="readout-section synonym-section trivial">
            <p className="trivial-note">
              {token.aa3} has only one codon — no synonymous choice to visualize.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
