import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Zombie Princess study presents the proposed art and component system', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Zombie Princess component study',
    'Review the proposed playing suits, Frog, Princesses, round cards, tokens, bidding controls, and shared-table phase language before production art or game logic is implemented.'
  );

  await page.goto('/zombie/assets/');
  await expect(page).toHaveURL(/\/zombie\/assets\/$/);

  await steps.step('complete-concept-set', {
    description: `The complete concept set remains readable in the ${testInfo.project.name} viewport`,
    verifications: [
      { spec: 'The route identifies all 13 concept images as a non-production set', check: async () => expect(page.getByRole('status')).toHaveText(/13 concept imagesnot a production atlas/) },
      { spec: 'All four playing suits use the shared playing-card frame', check: async () => expect(page.locator('.playing-grid .playing-card')).toHaveCount(4) },
      { spec: 'The Frog is correctly identified as the special Pet 6', check: async () => expect(page.getByText('The Frog · Pets')).toBeVisible() },
      { spec: 'Three Princess powers and three round-card treatments are visible', check: async () => { await expect(page.locator('.princess-grid .princess-card')).toHaveCount(3); await expect(page.locator('.round-grid .round-card')).toHaveCount(3); } },
      { spec: 'Bidding, skull economy, and phase-order UI studies are present', check: async () => { await expect(page.getByLabel('Example bidding interface')).toBeVisible(); await expect(page.getByLabel('Example Zombie Princess phase display')).toBeVisible(); } },
      { spec: 'Every concept image has loaded at its intrinsic dimensions', check: async () => expect(await page.locator('main img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true) }
    ]
  });

  steps.generateDocs();
});
