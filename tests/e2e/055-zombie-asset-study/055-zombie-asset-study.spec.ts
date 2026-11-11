import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const expectedPasses = [
  'Pass 4 cards left', 'Pass 1 card right', 'Pass 2 cards right', 'Pass 5 cards left',
  'Pass 5 cards left', 'Pass 1 card right', 'Pass 5 cards right', 'Pass 1 card left',
  'Pass 4 cards right', 'Pass 2 cards left', 'Pass 3 cards right', 'Pass 5 cards right',
  'Pass 2 cards left', 'Pass half your hand left', 'Pass 2 cards right', 'Pass 4 cards right',
  'Pass 4 cards left', 'Pass 1 card left', 'Pass half your hand right', 'Pass 3 cards right',
  'Pass 3 cards left', 'Pass 1 card left', 'Pass 4 cards right', 'Pass 3 cards left',
  'Pass 2 cards right', 'Pass 4 cards left'
];

test('Zombie Princess study presents the complete art and component system', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Zombie Princess complete asset review',
    'Review all 60 suited cards, 12 Princesses, 26 round cards, tokens, bidding controls, and shared-table phase language before game logic is implemented.'
  );

  await page.goto('/zombie/assets/');
  await expect(page).toHaveURL(/\/zombie\/assets\/$/);

  await steps.step('complete-asset-set', {
    description: `The complete asset set remains readable in the ${testInfo.project.name} viewport`,
    verifications: [
      { spec: 'The complete Zombie Princess gallery is present', check: async () => expect(page.getByRole('heading', { name: 'Zombie Princess' })).toBeVisible() },
      { spec: 'All 60 suited cards use the shared playing-card frame', check: async () => expect(page.locator('.playing-grid .playing-card')).toHaveCount(60) },
      { spec: 'The Frog is correctly identified as the special Pet 6', check: async () => expect(page.getByLabel('Pets 6, the Frog')).toHaveCount(1) },
      { spec: 'All 12 Princesses and all 26 round cards are present', check: async () => { await expect(page.locator('.princess-grid .princess-card')).toHaveCount(12); await expect(page.locator('.round-grid .round-card')).toHaveCount(26); } },
      { spec: 'Every Princess portrait is fully contained without cropping', check: async () => expect(await page.locator('.princess-art img').evaluateAll((images) => images.every((image) => getComputedStyle(image).objectFit === 'contain'))).toBe(true) },
      { spec: 'All 26 verified pass instructions match the printed A–Z sequence', check: async () => expect(await page.locator('.round-grid .pass-icon').evaluateAll((icons) => icons.map((icon) => icon.getAttribute('aria-label')))).toEqual(expectedPasses) },
      { spec: 'Bidding, skull economy, and phase-order UI studies are present', check: async () => { await expect(page.getByLabel('Example bidding interface')).toBeVisible(); await expect(page.getByLabel('Example Zombie Princess phase display')).toBeVisible(); } },
      { spec: 'Every asset has loaded at its intrinsic dimensions', check: async () => expect(await page.locator('main img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true) }
    ]
  });

  steps.generateDocs();
});
