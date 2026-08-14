import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('asset review exposes every atlas and exact integer crop', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Asset review', 'Review raw sprite sheets, integer cell boundaries, and every contained in-game crop without entering a game.');

  await page.goto('/assets/');
  await steps.step('fairy-crops', { description: 'The review route opens the irregular Fairy atlas with all twelve complete frames and their source coordinates', verifications: [
    { spec: 'The route keeps its GitHub Pages-compatible trailing slash', check: async () => expect(page).toHaveURL(/\/assets\/$/) },
    { spec: 'All nine source atlases are available', check: async () => expect(page.getByRole('navigation', { name: 'Asset atlases' }).getByRole('button')).toHaveCount(9) },
    { spec: 'The route reports all ninety-one sprites', check: async () => expect(page.getByRole('status')).toContainText('91 sprites') },
    { spec: 'Every Fairy rank has one computed crop', check: async () => expect(page.getByLabel('Fairy cards computed crops').locator('.crop-card')).toHaveCount(12) },
    { spec: 'The indivisible sheet ends exactly at pixel 1651', check: async () => expect(page.getByText('1376,477 · 275×476')).toBeVisible() }
  ] });

  await page.getByRole('button', { name: 'Round cards 21 cells', exact: true }).click();
  await steps.step('round-crops', { description: 'Switching atlases reveals all twenty-one Round cards with visible raw grid lines and no neighbouring-cell bleed', verifications: [
    { spec: 'All twenty-one Round crops are rendered', check: async () => expect(page.getByLabel('Round cards computed crops').locator('.crop-card')).toHaveCount(21) },
    { spec: 'The first crop starts at the source origin', check: async () => expect(page.getByText('0,0 · 253×296')).toBeVisible() },
    { spec: 'The final crop reaches the bottom-right source pixel', check: async () => expect(page.getByText('1521,591 · 253×296')).toBeVisible() }
  ] });

  steps.generateDocs();
});
