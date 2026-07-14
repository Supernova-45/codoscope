import { useEffect, useRef } from 'react';
import { useAtlasStore, hasSynonymShift } from '../store/atlasStore';
import { AA_CLASS_COLORS, getAaColors } from '../utils/colors';

export function SequenceStrip() {
  const document = useAtlasStore((s) => s.document);
  const selectedPosition = useAtlasStore((s) => s.selectedPosition);
  const setPosition = useAtlasStore((s) => s.setPosition);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = selectedRef.current;
    const scroller = button?.closest<HTMLElement>('.sequence-scroll');
    if (!button || !scroller) return;
    const left = button.offsetLeft - (scroller.clientWidth - button.clientWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [selectedPosition]);

  if (!document) return null;

  const compareOrg = compareMode && compareOrganism ? compareOrganism : null;

  return (
    <section className="panel sequence-strip-panel">
      <div className="panel-header">
        <h2>Coding sequence</h2>
        <span className="panel-meta">{document.tokens.length} codons · {document.sequence_id}</span>
      </div>
      <div className="sequence-scroll">
        <div className="sequence-track">
          {document.tokens.map((token) => {
            const colors = getAaColors(token.aa);
            const selected = token.pos === selectedPosition;
            const readout = document.per_organism[selectedOrganism]?.[token.pos];
            const shifted = compareOrg
              ? hasSynonymShift(document, selectedOrganism, compareOrg, token.pos)
              : false;
            return (
              <div className="position-column" key={token.pos}>
                <span className="position-number">{token.pos}</span>
                <button
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  className={`codon-box ${selected ? 'selected' : ''} ${shifted ? 'shifted' : ''} ${token.pos === 0 ? 'context-free' : ''}`}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: selected ? '#f4f1de' : colors.border,
                    color: colors.text,
                  }}
                  onClick={() => setPosition(token.pos)}
                  title={`${token.aa3} (${token.codon}) — position ${token.pos}`}
                  aria-label={`Position ${token.pos}: ${token.codon}, ${token.aa3}${shifted ? ', top synonym changes' : ''}`}
                  aria-pressed={selected}
                >
                  <span className="codon-aa">{token.aa3}</span>
                  <span className="codon-seq">{token.codon}</span>
                  {token.pos === 0 && <span className="context-badge">no context</span>}
                  {shifted && <span className="delta-badge" aria-hidden="true">Δ</span>}
                  {readout && (
                    <span className="metric-strips" aria-hidden="true">
                      <span
                        className="confidence-strip"
                        style={{ width: `${readout.aa_confidence * 100}%` }}
                      />
                      <span
                        className="entropy-strip"
                        style={{ width: `${readout.synonym_entropy * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="sequence-legends" aria-label="Sequence color legend">
        <span>Chemical class:</span>
        {Object.entries(AA_CLASS_COLORS).map(([name, colors]) => (
          <span key={name} className="aa-legend">
            <i style={{ background: colors.border }} /> {name}
          </span>
        ))}
        <span className="metric-legend confidence">AA confidence</span>
        <span className="metric-legend entropy">synonym entropy</span>
        {compareOrg && <span className="delta-legend">Δ top synonym changes</span>}
      </div>
    </section>
  );
}
