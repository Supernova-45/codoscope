import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
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
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const button = selectedRef.current;
    const scroller = button?.closest<HTMLElement>('.sequence-scroll');
    if (!button || !scroller) return;
    const left = button.offsetLeft - (scroller.clientWidth - button.clientWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [selectedPosition]);

  if (!document) return null;

  const compareOrg = compareMode && compareOrganism ? compareOrganism : null;
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    let next = position;
    if (event.key === 'ArrowRight') next = Math.min(document.tokens.length - 1, position + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, position - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = document.tokens.length - 1;
    else return;
    event.preventDefault();
    setPosition(next);
    window.requestAnimationFrame(() => {
      window.document
        .querySelector<HTMLButtonElement>(`.codon-box[data-position="${next}"]`)
        ?.focus();
    });
  };

  return (
    <section className="panel sequence-strip-panel">
      <div className="panel-header">
        <div>
          <h2>Coding sequence</h2>
          <span className="panel-meta">{document.tokens.length} codons · {document.sequence_id}</span>
        </div>
        <label className="sequence-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min="0.65"
            max="1.45"
            step="0.1"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="sequence-overview" aria-label="Sequence overview">
        {document.tokens.map((token) => {
          const colors = getAaColors(token.aa);
          return (
            <button
              type="button"
              key={token.pos}
              style={{ background: colors.border }}
              className={token.pos === selectedPosition ? 'active' : ''}
              onClick={() => setPosition(token.pos)}
              aria-label={`Jump to codon ${token.pos + 1}`}
              tabIndex={-1}
            />
          );
        })}
      </div>
      <div
        className="sequence-scroll"
        style={{ '--sequence-zoom': zoom } as CSSProperties}
      >
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
                <span className="position-number">{token.pos + 1}</span>
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
                  onKeyDown={(event) => navigate(event, token.pos)}
                  data-position={token.pos}
                  tabIndex={selected ? 0 : -1}
                  title={`${token.aa3} (${token.codon}) — codon ${token.pos + 1}, model index ${token.pos}`}
                  aria-label={`Codon ${token.pos + 1}, model position ${token.pos}: ${token.codon}, ${token.aa3}${shifted ? ', top synonym changes' : ''}`}
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
