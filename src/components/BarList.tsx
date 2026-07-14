import type { ReadoutEntry } from '../types/atlas';
import { READOUT_COLORS } from '../utils/colors';

interface BarListProps {
  title: string;
  entries: ReadoutEntry[];
  highlightLabel?: string;
}

export function BarList({ title, entries, highlightLabel }: BarListProps) {
  const stableEntries = [...entries].sort((a, b) => a.label.localeCompare(b.label));
  const rowHeight = 31;

  return (
    <div className="bar-list">
      <h4>{title}</h4>
      <ul style={{ height: `${entries.length * rowHeight}px` }}>
        {stableEntries.map((entry) => {
          const width = Math.max(0, Math.min(1, entry.score)) * 100;
          const color = READOUT_COLORS[entry.kind] ?? '#888';
          const highlighted = highlightLabel === entry.label;
          const rank = entries.findIndex((candidate) => (
            candidate.kind === entry.kind && candidate.label === entry.label
          ));
          return (
            <li
              key={`${entry.kind}-${entry.label}`}
              className={highlighted ? 'highlighted' : ''}
              style={{ transform: `translateY(${rank * rowHeight}px)` }}
            >
              <span className="bar-label" style={{ color }}>
                {entry.label}
                {highlighted && <span className="input-marker" title="Observed input">●</span>}
              </span>
              <div
                className="bar-track"
                role="meter"
                aria-label={`${entry.label} probability`}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={entry.score}
              >
                <div
                  className="bar-fill"
                  style={{
                    width: `${width}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="bar-score">{entry.score.toFixed(3)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface EntropyGaugeProps {
  value: number;
  label: string;
}

export function EntropyGauge({ value, label }: EntropyGaugeProps) {
  return (
    <div className="entropy-gauge">
      <span className="gauge-label">{label}</span>
      <div
        className="gauge-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
      >
        <div className="gauge-fill" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="gauge-value">{value.toFixed(2)}</span>
      <span className="gauge-hint">{value < 0.2 ? 'committed' : value > 0.7 ? 'flat' : 'mixed'}</span>
    </div>
  );
}
