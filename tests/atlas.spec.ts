import { expect, test } from '@playwright/test';

test('loads the real fixture and exposes the organism comparison story', async ({ page }) => {
  await page.goto('.');

  await expect(page.getByRole('heading', { name: 'Codoscope' })).toBeVisible();
  await expect(page.getByText('60 codons · ecoli_demo_gene')).toBeVisible();
  await expect(page.getByText(/positions change their top synonymous codon/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Position \d+ readout/ })).toBeVisible();
  await expect(page.getByText('Layer axis — depth of concept')).toBeVisible();
});

test('keeps comparison organisms distinct when the primary organism changes', async ({ page }) => {
  await page.goto('.');

  await page.getByRole('button', { name: /B\. subtilis/ }).click();
  await expect(page.getByRole('button', { name: /B\. subtilis/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Compare with:')).not.toHaveValue(/B\. subtilis/);
});

test('explains why position zero is excluded from synonym analysis', async ({ page }) => {
  await page.goto('.');

  await page.getByRole('button', { name: /Position 0:/ }).click();
  await expect(page.getByText(/no upstream codon context/)).toBeVisible();
});
