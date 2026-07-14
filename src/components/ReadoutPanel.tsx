import { useAtlasStore } from '../store/atlasStore';
import { BarList, EntropyGauge } from './BarList';
import { MethodBadge } from './MethodBadge';
import { SynonymComparison } from './SynonymComparison';

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
    <section className="panel readout-panel" id="position-inspector">
      <div className="panel-header">
        <div>
          <span className="panel-step">02 · inspect a codon</span>
          <h2>Codon {selectedPosition + 1} readout</h2>
          <span className="panel-meta">
            model index {selectedPosition} · {token.codon} · observed input
          </span>
        </div>
        <MethodBadge method="output" />
      </div>

      <div className="encoded-invariant">
        <div>
          <span>Encoded residue stays fixed</span>
          <strong>{token.aa3}</strong>
          <code>{token.codon}</code>
        </div>
        <p>
          The DNA input fixes this amino acid. The probability bars below show
          whether DeCodon also expects it under each organism token; those bars
          are allowed to change.
        </p>
      </div>

      <div className="readout-grid">
        <div className="readout-section aa-section">
          <BarList
            title="Predicted residue identity"
            entries={readout.aa_readout}
            highlightLabel={readout.true_aa}
          />
          <div className="confidence-chip">
            <span>Observed {token.aa3} probability</span>
            <strong>{(readout.aa_confidence * 100).toFixed(1)}%</strong>
          </div>
          {compareReadout && compareOrganism && (
            <div className="confidence-chip comparison-confidence">
              <span>{compareOrganism.split(' (')[0]}</span>
              <strong>{(compareReadout.aa_confidence * 100).toFixed(1)}%</strong>
            </div>
          )}
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
            {compareReadout && compareOrganism ? (
              <SynonymComparison
                primaryLabel={selectedOrganism}
                comparisonLabel={compareOrganism}
                primary={readout}
                comparison={compareReadout}
                trueCodon={readout.true_codon}
              />
            ) : (
              <BarList
                title={`Synonymous codon (${selectedOrganism})`}
                entries={readout.synonym_readout}
                highlightLabel={readout.true_codon}
              />
            )}
            <div className="entropy-stack">
              <EntropyGauge
                value={readout.synonym_entropy}
                label={`Normalized entropy · ${selectedOrganism.split(' (')[0]}`}
              />
              {compareReadout && compareOrganism && (
                <EntropyGauge
                  value={compareReadout.synonym_entropy}
                  label={`Normalized entropy · ${compareOrganism.split(' (')[0]}`}
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
