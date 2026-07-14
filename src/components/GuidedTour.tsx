import { useAtlasStore } from '../store/atlasStore';

interface TourStep {
  number: string;
  title: string;
  detail: string;
  target: string;
  action: () => void;
}

export function GuidedTour() {
  const examples = useAtlasStore((state) => state.examples);
  const selectedExampleId = useAtlasStore((state) => state.selectedExampleId);
  const setOrganism = useAtlasStore((state) => state.setOrganism);
  const setCompareOrganism = useAtlasStore((state) => state.setCompareOrganism);
  const setCompareMode = useAtlasStore((state) => state.setCompareMode);
  const setPosition = useAtlasStore((state) => state.setPosition);
  const setSelectedLayer = useAtlasStore((state) => state.setSelectedLayer);

  const example = examples.find((item) => item.id === selectedExampleId);
  if (!example) return null;

  const visit = (step: TourStep) => {
    step.action();
    document.getElementById(step.target)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const steps: TourStep[] = [
    {
      number: '1',
      title: 'Change the organism',
      detail: 'Only the taxid token changes; the input DNA sequence stays fixed.',
      target: 'organism-story',
      action: () => {
        setOrganism(example.recommendation.primary_organism);
        if (example.recommendation.compare_organism) {
          setCompareOrganism(example.recommendation.compare_organism);
          setCompareMode(true);
        }
      },
    },
    {
      number: '2',
      title: 'Inspect one codon',
      detail: 'Separate the protein-level amino acid from the organism-specific synonym.',
      target: 'position-inspector',
      action: () => setPosition(example.recommendation.position ?? 1),
    },
    {
      number: '3',
      title: 'Follow model depth',
      detail: 'Compare early organism information with mid-layer context and late amino-acid resolution.',
      target: (
        example.method === 'jacobian_lens' || example.method === 'logit_lens'
          ? 'layer-position-atlas'
          : 'layer-evidence'
      ),
      action: () => setSelectedLayer(example.recommendation.layer ?? 7),
    },
  ];

  return (
    <nav className="guided-tour" aria-label="Guided atlas tour">
      <span className="tour-label">Follow the story</span>
      <ol>
        {steps.map((step) => (
          <li key={step.number}>
            <button type="button" onClick={() => visit(step)}>
              <span className="tour-number">{step.number}</span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
