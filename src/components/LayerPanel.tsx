import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAtlasStore } from '../store/atlasStore';
import { CONCEPT_COLORS, CONCEPT_LABELS } from '../utils/colors';

const FEATURED_CONCEPTS = [
  'organism_taxid',
  'rel_position_in_CDS',
  'amino_acid_identity',
];

export function LayerPanel() {
  const document = useAtlasStore((s) => s.document);
  const hoveredLayer = useAtlasStore((s) => s.hoveredLayer);
  const setHoveredLayer = useAtlasStore((s) => s.setHoveredLayer);
  const svgRef = useRef<SVGSVGElement>(null);

  const conceptLayers = document?.concept_layers;

  useEffect(() => {
    if (!conceptLayers || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = 520 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const layers = conceptLayers.layers;
    const x = d3.scaleLinear().domain([0, layers.length - 1]).range([0, width]);

    const allScores = FEATURED_CONCEPTS.flatMap((key) => {
      const c = conceptLayers.concepts[key];
      return c ? c.scores : [];
    });
    const yMin = Math.min(0, ...allScores) - 0.05;
    const yMax = Math.max(...allScores) + 0.05;
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat((d) => `L${d}`))
      .selectAll('text')
      .style('fill', '#a0a0a0');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('fill', '#a0a0a0');

    g.selectAll('.axis line, .axis path').style('stroke', '#444');

    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    FEATURED_CONCEPTS.forEach((key) => {
      const concept = conceptLayers.concepts[key];
      if (!concept) return;
      const color = CONCEPT_COLORS[key] ?? '#888';
      const label = CONCEPT_LABELS[key] ?? key;

      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', y(concept.baseline))
        .attr('y2', y(concept.baseline))
        .attr('stroke', color)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.4);

      g.append('path')
        .datum(concept.scores)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('d', line);

      g.append('text')
        .attr('x', width + 4)
        .attr('y', y(concept.scores[concept.scores.length - 1]))
        .attr('dy', '0.35em')
        .attr('fill', color)
        .attr('font-size', '11px')
        .text(label);
    });

    if (hoveredLayer !== null) {
      g.append('line')
        .attr('x1', x(hoveredLayer))
        .attr('x2', x(hoveredLayer))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#f4f1de')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8);
    }

    const overlay = g
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const layer = Math.round(x.invert(mx));
        const clamped = Math.max(0, Math.min(layers.length - 1, layer));
        setHoveredLayer(clamped);
      })
      .on('mouseleave', () => setHoveredLayer(null));
    overlay.lower();
  }, [conceptLayers, hoveredLayer, setHoveredLayer]);

  if (!conceptLayers) return null;

  return (
    <section className="panel layer-panel">
      <div className="panel-header">
        <h2>Layer axis — depth of concept</h2>
        <p className="layer-caption">
          Different biology resolves at different depths: organism at the bottom, position in the middle, amino acid at the top.
        </p>
      </div>
      <svg ref={svgRef} width={520} height={280} className="layer-chart" />
      {hoveredLayer !== null && (
        <div className="layer-tooltip">
          Layer {hoveredLayer}
          {FEATURED_CONCEPTS.map((key) => {
            const c = conceptLayers.concepts[key];
            if (!c) return null;
            return (
              <span key={key} style={{ color: CONCEPT_COLORS[key] }}>
                {CONCEPT_LABELS[key]}: {c.scores[hoveredLayer]?.toFixed(3)}
              </span>
            );
          })}
        </div>
      )}
      <div className="layer-legend">
        <span className="legend-item organism">Organism — high from L1 (input token)</span>
        <span className="legend-item position">Position — mid-layer bump (~L7)</span>
        <span className="legend-item amino">Amino acid — late buildup (L9→L12)</span>
      </div>
    </section>
  );
}
