import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarList, EntropyGauge } from './BarList';

describe('BarList', () => {
  it('uses an absolute probability scale rather than normalizing the winner', () => {
    render(
      <BarList
        title="Synonyms"
        entries={[
          { label: 'GCT', kind: 'codon', score: 0.1 },
          { label: 'GCC', kind: 'codon', score: 0.05 },
        ]}
      />,
    );

    const meter = screen.getByRole('meter', { name: 'GCT probability' });
    expect(meter).toHaveAttribute('aria-valuenow', '0.1');
    expect(meter.firstElementChild).toHaveStyle({ width: '10%' });
  });
});

describe('EntropyGauge', () => {
  it('exposes its numeric value to assistive technology', () => {
    render(<EntropyGauge value={0.42} label="Synonym entropy" />);
    expect(screen.getByRole('meter', { name: 'Synonym entropy' }))
      .toHaveAttribute('aria-valuenow', '0.42');
  });
});
