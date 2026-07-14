import { useAtlasStore } from '../store/atlasStore';
import { MethodBadge } from './MethodBadge';

export function ExampleGallery() {
  const examples = useAtlasStore((state) => state.examples);
  const selectedExampleId = useAtlasStore((state) => state.selectedExampleId);
  const loadExample = useAtlasStore((state) => state.loadExample);
  const loading = useAtlasStore((state) => state.loading);

  if (!examples.length) return null;

  const choose = async (id: string) => {
    await loadExample(id);
    document.getElementById('atlas-workspace')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="examples" className="examples-section" aria-labelledby="examples-title">
      <div className="section-heading">
        <span className="section-kicker">Built-in stories</span>
        <h2 id="examples-title">Three ways into the model</h2>
        <p>Every number below comes from the real DeCodon fixture or measured probe evidence.</p>
      </div>
      <div className="example-grid">
        {examples.map((example) => {
          const active = example.id === selectedExampleId;
          return (
            <article key={example.id} className={`example-card ${active ? 'active' : ''}`}>
              <div className="example-card-topline">
                <span>{example.eyebrow}</span>
                <MethodBadge method={example.method} />
              </div>
              <h3>{example.title}</h3>
              <p className="example-takeaway">{example.takeaway}</p>
              <p className="example-description">{example.description}</p>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>{example.source_accession}</dd>
                </div>
                <div>
                  <dt>Focus</dt>
                  <dd>
                    {example.recommendation.position !== undefined
                      ? `codon ${example.recommendation.position + 1}`
                      : `layer ${example.recommendation.layer}`}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="example-action"
                onClick={() => choose(example.id)}
                disabled={loading}
                aria-pressed={active}
              >
                {active ? 'Currently exploring' : 'Open this story'}
                <span aria-hidden="true">→</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
