import { Fragment, useState, type CSSProperties } from 'react';
import { useAtlasStore } from '../store/atlasStore';
import { MethodBadge } from './MethodBadge';

type AtlasView = 'amino-acid' | 'codon';

export function LayerPositionAtlas() {
  const document = useAtlasStore((state) => state.document);
  const selectedOrganism = useAtlasStore((state) => state.selectedOrganism);
  const selectedPosition = useAtlasStore((state) => state.selectedPosition);
  const selectedLayer = useAtlasStore((state) => state.selectedLayer);
  const pinnedLabels = useAtlasStore((state) => state.pinnedLabels);
  const setPosition = useAtlasStore((state) => state.setPosition);
  const setSelectedLayer = useAtlasStore((state) => state.setSelectedLayer);
  const [view, setView] = useState<AtlasView>('amino-acid');

  if (!document) return null;
  const lens = document.lens;
  if (!lens) {
    return (
      <section className="panel lens-placeholder" aria-labelledby="lens-placeholder-title">
        <div>
          <span className="panel-step">Per-position layer atlas</span>
          <h2 id="lens-placeholder-title">Lens data is being fitted, not fabricated</h2>
          <p>
            This example contains final DeCodon outputs and independent global
            probes. A layer×position grid appears only when a measured logit or
            Jacobian lens artifact is present in the document.
          </p>
        </div>
        <MethodBadge method="jacobian_lens" />
      </section>
    );
  }

  const positions = lens.per_organism[selectedOrganism];
  if (!positions) return null;
  const pinned = pinnedLabels.find((label) => (
    lens.rank_tracks[selectedOrganism]?.[label]
  ));
  const rankTrack = pinned
    ? lens.rank_tracks[selectedOrganism]?.[pinned]
    : undefined;

  const chooseCell = (position: number, layer: number) => {
    setPosition(position);
    setSelectedLayer(layer);
  };

  return (
    <section
      className="panel layer-position-panel"
      id="layer-position-atlas"
      aria-labelledby="layer-position-title"
    >
      <div className="panel-header">
        <div>
          <span className="panel-step">Measured layer × position readout</span>
          <h2 id="layer-position-title">What each hidden state is poised to output</h2>
          <p className="layer-caption">
            Columns are codon positions; rows are model depth. Select any cell
            to link the sequence, layer, and inspector.
          </p>
        </div>
        <MethodBadge method={lens.method} />
      </div>

      <div className="lens-toolbar">
        <div className="view-segmented" role="group" aria-label="Atlas cell labels">
          {(['amino-acid', 'codon'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={view === option ? 'active' : ''}
              onClick={() => setView(option)}
              aria-pressed={view === option}
            >
              {option === 'amino-acid' ? 'Amino acid' : 'Codon'}
            </button>
          ))}
        </div>
        <p>
          {lens.method === 'jacobian_lens'
            ? `${lens.fit?.n_sequences ?? 'Measured'} fitting sequences · averaged Jacobian transport`
            : 'Nonlinear LM head applied directly to each hidden layer · baseline, not a Jacobian'}
        </p>
      </div>

      <div className="lens-grid-scroll">
        <div
          className="lens-grid"
          role="grid"
          aria-label={`${view} readouts by layer and codon position`}
          style={{ '--position-count': document.tokens.length } as CSSProperties}
        >
          <span className="lens-corner" aria-hidden="true">layer</span>
          {document.tokens.map((token) => (
            <span key={token.pos} className="lens-position-label" aria-hidden="true">
              {token.pos + 1}
            </span>
          ))}
          {[...lens.layers].reverse().map((layer) => (
            <Fragment key={layer}>
              <span className="lens-layer-label">L{layer}</span>
              {positions.map((position) => {
                const readout = position.layers.find((item) => item.layer === layer);
                const entry = view === 'amino-acid'
                  ? readout?.aa_readout[0]
                  : readout?.codon_readout[0];
                const strength = entry?.score ?? 0;
                const active = selectedPosition === position.pos && selectedLayer === layer;
                return (
                  <button
                    key={`${layer}-${position.pos}`}
                    type="button"
                    role="gridcell"
                    className={`lens-cell ${active ? 'active' : ''}`}
                    style={{
                      borderColor: `rgba(121, 188, 235, ${0.08 + strength * 0.4})`,
                      backgroundColor: `rgba(91, 159, 212, ${0.025 + strength * 0.18})`,
                      color: `rgba(232, 230, 227, ${0.45 + strength * 0.55})`,
                    }}
                    onClick={() => chooseCell(position.pos, layer)}
                    aria-label={`Layer ${layer}, codon position ${position.pos + 1}: ${entry?.label ?? 'no readout'}, score ${entry?.score.toFixed(3) ?? 'unknown'}`}
                    aria-selected={active}
                  >
                    {entry?.label ?? '—'}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {pinned && rankTrack && (
        <div className="rank-heatmap">
          <div className="rank-heatmap-heading">
            <div>
              <span className="panel-step">Pinned codon rank</span>
              <h3>{pinned} across the atlas</h3>
            </div>
            <span>bright = high rank</span>
          </div>
          <div
            className="rank-grid"
            style={{ '--position-count': document.tokens.length } as CSSProperties}
          >
            {[...lens.layers].reverse().map((layer, reversedIndex) => {
              const layerIndex = lens.layers.length - 1 - reversedIndex;
              return (
                <Fragment key={layer}>
                  <span className="lens-layer-label">L{layer}</span>
                  {rankTrack.map((row, position) => {
                    const rank = row[layerIndex];
                    const strength = 1 - Math.log(Math.max(rank, 1)) / Math.log(64);
                    return (
                      <button
                        key={`rank-${layer}-${position}`}
                        type="button"
                        style={{
                          backgroundColor: `rgba(217, 160, 91, ${0.04 + strength * 0.82})`,
                        }}
                        onClick={() => chooseCell(position, layer)}
                        aria-label={`${pinned} rank ${rank} at layer ${layer}, position ${position + 1}`}
                        title={`rank ${rank}`}
                      >
                        {rank <= 5 ? rank : ''}
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <p className="lens-provenance">
        Model {lens.model_revision.slice(0, 12)} · {lens.normalization} · {lens.target_positions}
      </p>
    </section>
  );
}
