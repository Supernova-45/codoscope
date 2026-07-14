import type { ReadoutEntry } from '../types/atlas';
import { READOUT_COLORS } from '../utils/colors';

interface BarListProps {
  title: string;
  entries: ReadoutEntry[];
  animateKey?: string;
  highlightLabel?: string;
}

export function BarList({ title, entries, animateKey, highlightLabel }: BarListProps) {
  const maxScore = Math.max(...entries.map((e) => e.score), 0.01);

  return (
    <div className="bar-list" key={animateKey}>
      <h4>{title}</h4>
      <ul>
        {entries.map((entry) => {
          const width = (entry.score / maxScore) * 100;
          const color = READOUT_COLORS[entry.kind] ?? '#888';
          const highlighted = highlightLabel === entry.label;
          return (
            <li key={`${entry.kind}-${entry.label}`} className={highlighted ? 'highlighted' : ''}>
              <span className="bar-label" style={{ color }}>{entry.label}</span>
              <div className="bar-track">
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
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="gauge-value">{value.toFixed(2)}</span>
      <span className="gauge-hint">{value < 0.2 ? 'committed' : value > 0.7 ? 'flat' : 'mixed'}</span>
    </div>
  );
}
