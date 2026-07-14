import { useAtlasStore } from '../store/atlasStore';
import { CONCEPT_COLORS, CONCEPT_LABELS } from '../utils/colors';
import { MethodBadge } from './MethodBadge';

const FEATURED_CONCEPTS = [
  'organism_taxid',
  'rel_position_in_CDS',
  'amino_acid_identity',
  'aa_chem_class',
];

const WIDTH = 760;
const HEIGHT = 330;
const PLOT = { left: 58, right: 710, top: 42, bottom: 270 };
const Y_MIN = -0.15;
const Y_MAX = 1.05;

export function LayerPanel() {
  const document = useAtlasStore((s) => s.document);
  const selectedLayer = useAtlasStore((s) => s.selectedLayer);
  const hoveredLayer = useAtlasStore((s) => s.hoveredLayer);
  const setSelectedLayer = useAtlasStore((s) => s.setSelectedLayer);
  const setHoveredLayer = useAtlasStore((s) => s.setHoveredLayer);
  const conceptLayers = document?.concept_layers;

  if (!conceptLayers) return null;

  const layers = conceptLayers.layers;
  const firstLayer = layers[0] ?? 0;
  const lastLayer = layers.at(-1) ?? 12;
  const x = (layer: number) => (
    PLOT.left
    + ((layer - firstLayer) / Math.max(1, lastLayer - firstLayer))
    * (PLOT.right - PLOT.left)
  );
  const y = (score: number) => (
    PLOT.bottom
    - ((score - Y_MIN) / (Y_MAX - Y_MIN))
    * (PLOT.bottom - PLOT.top)
  );
  const pathFor = (scores: number[]) => scores
    .map((score, index) => `${index === 0 ? 'M' : 'L'} ${x(layers[index] ?? index)} ${y(score)}`)
    .join(' ');
  const displayLayer = hoveredLayer ?? selectedLayer;
  const displayIndex = displayLayer === null ? -1 : layers.indexOf(displayLayer);
  const yTicks = [-0.1, 0, 0.25, 0.5, 0.75, 1];
  const earlyEnd = firstLayer + (lastLayer - firstLayer) * 0.29;
  const middleEnd = firstLayer + (lastLayer - firstLayer) * 0.71;

  const layerFromPointer = (event: React.PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return null;
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const approximate = firstLayer
      + ((pointerX - PLOT.left) / (PLOT.right - PLOT.left))
      * (lastLayer - firstLayer);
    return layers.reduce((best, layer) => (
      Math.abs(layer - approximate) < Math.abs(best - approximate) ? layer : best
    ), layers[0] ?? 0);
  };

  return (
    <section className="panel layer-panel" id="layer-evidence">
      <div className="panel-header">
        <div>
          <span className="panel-step">03 · follow model depth</span>
          <h2>Independent probe evidence</h2>
          <p className="layer-caption">
            Global benchmark — it does not change with the selected organism or
            codon. Classifiers report accuracy; the position regressor reports R².
          </p>
        </div>
        <MethodBadge method="probe" />
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="layer-chart"
        role="img"
        aria-label="Probe scores across DeCodon layers"
      >
        <title>Biological concept probe scores by DeCodon layer</title>
        <desc>
          Organism identity is available early, relative coding-sequence position
          peaks in middle layers, and amino-acid concepts build in late layers.
        </desc>

        <g className="layer-regimes" aria-hidden="true">
          <rect x={x(firstLayer)} y={PLOT.top} width={x(earlyEnd) - x(firstLayer)} height={PLOT.bottom - PLOT.top} />
          <rect x={x(earlyEnd)} y={PLOT.top} width={x(middleEnd) - x(earlyEnd)} height={PLOT.bottom - PLOT.top} />
          <rect x={x(middleEnd)} y={PLOT.top} width={x(lastLayer) - x(middleEnd)} height={PLOT.bottom - PLOT.top} />
          <text x={(x(firstLayer) + x(earlyEnd)) / 2} y={27}>organism available</text>
          <text x={(x(earlyEnd) + x(middleEnd)) / 2} y={27}>position builds</text>
          <text x={(x(middleEnd) + x(lastLayer)) / 2} y={27}>amino acid resolves</text>
        </g>

        {yTicks.map((tick) => (
          <g key={tick} className="chart-grid" aria-hidden="true">
            <line x1={PLOT.left} x2={PLOT.right} y1={y(tick)} y2={y(tick)} />
            <text x={PLOT.left - 10} y={y(tick) + 4}>{tick.toFixed(tick === 0 ? 0 : 2)}</text>
          </g>
        ))}

        {layers.map((layer) => (
          <g key={layer} className="x-tick" aria-hidden="true">
            <line x1={x(layer)} x2={x(layer)} y1={PLOT.bottom} y2={PLOT.bottom + 5} />
            <text x={x(layer)} y={PLOT.bottom + 22}>L{layer}</text>
          </g>
        ))}
        <text className="axis-label" x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 8}>model depth</text>
        <text
          className="axis-label"
          transform={`translate(14 ${(PLOT.top + PLOT.bottom) / 2}) rotate(-90)`}
        >
          accuracy / R²
        </text>

        {FEATURED_CONCEPTS.map((key) => {
          const concept = conceptLayers.concepts[key];
          if (!concept) return null;
          const color = CONCEPT_COLORS[key] ?? '#888';
          return (
            <g key={key}>
              <line
                className="baseline-line"
                x1={PLOT.left}
                x2={PLOT.right}
                y1={y(concept.baseline)}
                y2={y(concept.baseline)}
                stroke={color}
              />
              <path
                className="concept-line"
                d={pathFor(concept.scores)}
                stroke={color}
              />
              {displayIndex >= 0 && concept.scores[displayIndex] !== undefined && (
                <circle
                  cx={x(displayLayer ?? 0)}
                  cy={y(concept.scores[displayIndex])}
                  r={4}
                  fill={color}
                />
              )}
            </g>
          );
        })}

        {displayLayer !== null && (
          <line
            className="hover-line"
            x1={x(displayLayer)}
            x2={x(displayLayer)}
            y1={PLOT.top}
            y2={PLOT.bottom}
          />
        )}
        <rect
          className="chart-hit-area"
          x={PLOT.left}
          y={PLOT.top}
          width={PLOT.right - PLOT.left}
          height={PLOT.bottom - PLOT.top}
          onPointerMove={(event) => setHoveredLayer(layerFromPointer(event))}
          onPointerDown={(event) => setSelectedLayer(layerFromPointer(event))}
          onPointerLeave={() => setHoveredLayer(null)}
        />
      </svg>
      <div className="layer-buttons" aria-label="Select model layer">
        {layers.map((layer) => (
          <button
            key={layer}
            type="button"
            className={layer === selectedLayer ? 'active' : ''}
            onClick={() => setSelectedLayer(layer)}
            aria-pressed={layer === selectedLayer}
          >
            L{layer}
          </button>
        ))}
      </div>
      {displayLayer !== null && (
        <div className="layer-tooltip" aria-live="polite">
          Layer {displayLayer}
          {FEATURED_CONCEPTS.map((key) => {
            const c = conceptLayers.concepts[key];
            if (!c) return null;
            return (
              <span key={key} style={{ color: CONCEPT_COLORS[key] }}>
                {CONCEPT_LABELS[key]}: {c.scores[displayIndex]?.toFixed(3)}
              </span>
            );
          })}
        </div>
      )}
      <div className="layer-legend">
        {FEATURED_CONCEPTS.map((key) => (
          <span key={key} className="legend-item">
            <i style={{ background: CONCEPT_COLORS[key] }} />
            {CONCEPT_LABELS[key]}
            {' '}
            ({conceptLayers.concepts[key]?.kind === 'reg' ? 'R²' : 'accuracy'})
          </span>
        ))}
        <span className="baseline-key">dotted lines = baselines</span>
      </div>
    </section>
  );
}
