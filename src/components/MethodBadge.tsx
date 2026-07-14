import type { MeasurementMethod } from '../types/atlas';

const LABELS: Record<MeasurementMethod, string> = {
  output: 'DeCodon output',
  logit_lens: 'Logit lens',
  jacobian_lens: 'Jacobian lens',
  probe: 'Independent probe',
};

const DESCRIPTIONS: Record<MeasurementMethod, string> = {
  output: 'Probabilities produced by the model at its final output layer.',
  logit_lens: 'Intermediate activations decoded directly through the unembedding.',
  jacobian_lens: 'Intermediate activations transported with an averaged causal Jacobian before decoding.',
  probe: 'A separately trained measurement of information available in hidden states.',
};

export function MethodBadge({ method }: { method: MeasurementMethod }) {
  return (
    <span
      className={`method-badge method-${method}`}
      title={DESCRIPTIONS[method]}
    >
      {LABELS[method]}
    </span>
  );
}
