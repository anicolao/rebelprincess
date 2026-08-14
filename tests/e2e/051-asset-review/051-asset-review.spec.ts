import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('asset review exposes every atlas and its source-specific crop map', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Asset review', 'Review raw sprite sheets, source-specific cell boundaries, and every in-game crop without entering a game.');

  await page.goto('/assets/');
  await steps.step('fairy-crops', { description: 'The review route opens the irregular Fairy atlas with all twelve complete frames and their source coordinates', verifications: [
    { spec: 'The route keeps its GitHub Pages-compatible trailing slash', check: async () => expect(page).toHaveURL(/\/assets\/$/) },
    { spec: 'All nine source atlases are available', check: async () => expect(page.getByRole('navigation', { name: 'Asset atlases' }).getByRole('button')).toHaveCount(9) },
    { spec: 'The route reports all ninety-one sprites', check: async () => expect(page.getByRole('status')).toContainText('91 sprites') },
    { spec: 'Every Fairy rank has one computed crop', check: async () => expect(page.getByLabel('Fairy cards computed crops').locator('.crop-card')).toHaveCount(12) },
    { spec: 'Generated gameplay cards fill their canonical frame', check: async () => expect(page.getByLabel('Fairy cards computed crops').locator('.card-art[data-fit="stretch"]')).toHaveCount(12) },
    { spec: 'The indivisible sheet ends exactly at pixel 1651', check: async () => expect(page.getByText('1376,477 · 275×476')).toBeVisible() }
  ] });

  await page.getByRole('button', { name: 'Original suit families 4 cells', exact: true }).click();
  await steps.step('original-family-crops', { description: 'The four original suit-family panels use their native source widths instead of a shared gameplay-card ratio', verifications: [
    { spec: 'All four original suit families are rendered', check: async () => expect(page.getByLabel('Original suit families computed crops').locator('.crop-card')).toHaveCount(4) },
    { spec: 'The first panel reports its native frame aspect', check: async () => expect(page.getByLabel('Original suit families computed crops').locator('.card-art').first()).toHaveAttribute('data-frame-aspect', '0.46834') }
  ] });

  await page.getByRole('button', { name: 'Princesses 10 cells', exact: true }).click();
  await steps.step('princess-crops', { description: 'Measured Princess rectangles exclude every unequal white gutter in the original portrait sheet', verifications: [
    { spec: 'All ten original Princess portraits are rendered', check: async () => expect(page.getByLabel('Princesses computed crops').locator('.crop-card')).toHaveCount(10) },
    { spec: 'The first portrait starts after the outer gutter', check: async () => expect(page.getByText('6,5 · 312×504')).toBeVisible() },
    { spec: 'The final portrait stops before the bottom and right gutters', check: async () => expect(page.getByText('1219,516 · 309×499')).toBeVisible() }
  ] });

  await page.getByRole('button', { name: 'Round cards 21 cells', exact: true }).click();
  await steps.step('round-crops', { description: 'Measured Round-card rectangles exclude the unequal cream gutters around all twenty-one vignettes', verifications: [
    { spec: 'All twenty-one Round crops are rendered', check: async () => expect(page.getByLabel('Round cards computed crops').locator('.crop-card')).toHaveCount(21) },
    { spec: 'The first crop excludes its top and left gutters', check: async () => expect(page.getByText('7,7 · 243×263')).toBeVisible() },
    { spec: 'The final crop excludes its bottom and right gutters', check: async () => expect(page.getByText('1525,580 · 243×276')).toBeVisible() }
  ] });

  await page.getByRole('button', { name: 'Deluxe Round cards 6 cells', exact: true }).click();
  await expect(page.getByLabel('Deluxe Round cards computed crops').locator('.card-art[data-fit="contain"]')).toHaveCount(6);

  steps.generateDocs();
});
