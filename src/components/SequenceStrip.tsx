import { useAtlasStore, hasSynonymShift } from '../store/atlasStore';
import { getAaColors } from '../utils/colors';

export function SequenceStrip() {
  const document = useAtlasStore((s) => s.document);
  const selectedPosition = useAtlasStore((s) => s.selectedPosition);
  const setPosition = useAtlasStore((s) => s.setPosition);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);

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
            const shifted = compareOrg
              ? hasSynonymShift(document, selectedOrganism, compareOrg, token.pos)
              : false;
            return (
              <button
                key={token.pos}
                type="button"
                className={`codon-box ${selected ? 'selected' : ''} ${shifted ? 'shifted' : ''}`}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: selected ? '#f4f1de' : colors.border,
                  color: colors.text,
                }}
                onClick={() => setPosition(token.pos)}
                title={`${token.aa3} (${token.codon}) — position ${token.pos}`}
              >
                <span className="codon-aa">{token.aa3}</span>
                <span className="codon-seq">{token.codon}</span>
                {shifted && <span className="delta-badge">Δ</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
