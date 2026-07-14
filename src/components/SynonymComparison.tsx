import type { PositionReadout } from '../types/atlas';
import { useAtlasStore } from '../store/atlasStore';
import { synonymDistance } from '../utils/atlas';

interface SynonymComparisonProps {
  primaryLabel: string;
  comparisonLabel: string;
  primary: PositionReadout;
  comparison: PositionReadout;
  trueCodon?: string;
}

function shortOrganism(label: string) {
  return label.split(' (')[0];
}

export function SynonymComparison({
  primaryLabel,
  comparisonLabel,
  primary,
  comparison,
  trueCodon,
}: SynonymComparisonProps) {
  const pinnedLabels = useAtlasStore((state) => state.pinnedLabels);
  const togglePinnedLabel = useAtlasStore((state) => state.togglePinnedLabel);
  const first = new Map(primary.synonym_readout.map((entry, index) => (
    [entry.label, { score: entry.score, rank: index + 1 }]
  )));
  const second = new Map(comparison.synonym_readout.map((entry, index) => (
    [entry.label, { score: entry.score, rank: index + 1 }]
  )));
  const labels = [...new Set([...first.keys(), ...second.keys()])]
    .sort((a, b) => (
      Math.max(second.get(b)?.score ?? 0, first.get(b)?.score ?? 0)
      - Math.max(second.get(a)?.score ?? 0, first.get(a)?.score ?? 0)
    ));
  const firstTop = primary.synonym_readout[0]?.label;
  const secondTop = comparison.synonym_readout[0]?.label;
  const distance = synonymDistance(primary, comparison);

  return (
    <div className="synonym-comparison">
      <div className="comparison-summary" role="status">
        <span className="comparison-delta">Δ {(distance * 100).toFixed(0)}%</span>
        <p>
          {firstTop === secondTop
            ? <>Both organisms rank <strong>{firstTop}</strong> first, but with different confidence.</>
            : <>The top preference moves from <strong>{firstTop}</strong> to <strong>{secondTop}</strong>.</>}
        </p>
      </div>

      <div className="comparison-head" aria-hidden="true">
        <span>codon</span>
        <span>{shortOrganism(primaryLabel)}</span>
        <span>{shortOrganism(comparisonLabel)}</span>
        <span>rank</span>
      </div>
      <ul>
        {labels.map((label) => {
          const a = first.get(label) ?? { score: 0, rank: labels.length };
          const b = second.get(label) ?? { score: 0, rank: labels.length };
          const rankDelta = a.rank - b.rank;
          const pinned = pinnedLabels.includes(label);
          return (
            <li key={label} className={label === trueCodon ? 'observed' : ''}>
              <button
                type="button"
                className={`comparison-codon ${pinned ? 'pinned' : ''}`}
                onClick={() => togglePinnedLabel(label)}
                aria-pressed={pinned}
                title={pinned ? `Unpin ${label}` : `Pin ${label} for layer tracking`}
              >
                {label}
                {label === trueCodon && <i title="Observed input">●</i>}
              </button>
              <div className="paired-bar primary-bar">
                <span style={{ width: `${a.score * 100}%` }} />
                <small>{a.score.toFixed(3)}</small>
              </div>
              <div className="paired-bar comparison-bar">
                <span style={{ width: `${b.score * 100}%` }} />
                <small>{b.score.toFixed(3)}</small>
              </div>
              <span className={`rank-shift ${rankDelta === 0 ? 'flat' : ''}`}>
                {rankDelta === 0 ? '—' : rankDelta > 0 ? `↑${rankDelta}` : `↓${Math.abs(rankDelta)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="pin-hint">Select a codon label to pin it for layer tracking.</p>
    </div>
  );
}
