import { expect, test } from '@playwright/test';

test('loads the real fixture and exposes the organism comparison story', async ({ page }) => {
  await page.goto('.');

  await expect(page.getByRole('heading', { name: 'Codoscope' })).toBeVisible();
  await expect(page.getByText('60 codons · ecoli_demo_gene')).toBeVisible();
  await expect(page.getByText(/codons change their top synonym/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Codon \d+ readout/ })).toBeVisible();
  await expect(page.getByText('Independent probe evidence')).toBeVisible();
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

  await page.getByRole('button', { name: /Codon 1, model position 0:/ }).click();
  await expect(page.getByText(/no upstream codon context/)).toBeVisible();
});

test('loads a guided example and writes shareable atlas state to the URL', async ({ page }) => {
  await page.goto('.');

  const card = page.getByRole('article').filter({ hasText: 'Strong and weak organism signals' });
  await card.getByRole('button', { name: 'Open this story' }).click();

  await expect(page).toHaveURL(/example=signal-calibration/);
  await expect(page).toHaveURL(/position=14/);
  await expect(card.getByRole('button', { name: 'Currently exploring' })).toBeVisible();
});

test('pins a synonymous codon from the aligned comparison', async ({ page }) => {
  await page.goto('.');

  const firstCodon = page.locator('.comparison-codon').first();
  const label = (await firstCodon.textContent())?.replace(/[^ACGT]/g, '');
  await firstCodon.click();

  await expect(firstCodon).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(new RegExp(`pins=${label}`));
});

test('moves through codons with a single roving keyboard focus', async ({ page }) => {
  await page.goto('.');

  const selected = page.locator('.codon-box[aria-pressed="true"]');
  await expect(selected).toHaveCount(1);
  await selected.focus();
  await page.keyboard.press('ArrowRight');

  await expect(page).toHaveURL(/position=39/);
  await expect(page.getByRole('heading', { name: 'Codon 40 readout' })).toBeVisible();
  await expect(page.locator('.codon-box[tabindex="0"]')).toHaveCount(1);
});

test('opens the measured layer-by-position logit-lens baseline', async ({ page }) => {
  await page.goto('.');

  const card = page.getByRole('article').filter({ hasText: 'Decode every hidden layer directly' });
  await card.getByRole('button', { name: 'Open this story' }).click();

  await expect(page.getByRole('heading', {
    name: 'What each hidden state is poised to output',
  })).toBeVisible();
  await expect(page.getByText('Nonlinear LM head applied directly')).toBeVisible();
  await expect(page.locator('.lens-cell')).toHaveCount(13 * 60);
});

test('opens the validated Jacobian lens and tracks a pinned codon rank', async ({ page }) => {
  await page.goto('.');

  const card = page.getByRole('article').filter({ hasText: 'Transport hidden states into codon space' });
  await card.getByRole('button', { name: 'Open this story' }).click();

  await expect(page.getByText('100 fitting sequences')).toBeVisible();
  await expect(page.locator('.lens-cell')).toHaveCount(12 * 60);
  const codon = page.locator('.comparison-codon').first();
  const label = (await codon.textContent())?.replace(/[^ACGT]/g, '');
  await codon.click();
  await expect(page.getByRole('heading', { name: `${label} across the atlas` })).toBeVisible();
});
