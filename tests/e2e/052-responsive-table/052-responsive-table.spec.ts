import { expect, test } from '@playwright/test';
import { closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = { phone: 'SIZE0052', desktop: 'SIZE1052' } as const;
const NAMES = ['Alex', 'Jo', 'Sam', 'Bea', 'Cleo', 'Diya'];

test('six-player table scales its cards, seats, Princesses, and copy to the viewport', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Responsive six-player table', 'Deal the densest supported table at phone and desktop sizes and verify that primary game assets grow into available space without leaving the viewport.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Once Upon a Time…', undefined, [], undefined, NAMES);

  const minimum = testInfo.project.name === 'phone'
    ? { hand: 46, round: 106, princess: 34 }
    : { hand: 70, round: 140, princess: 44 };
  await steps.step('six-player-ready', { description: `All six seats use the ${testInfo.project.name} viewport while the active hand, Round card, Princesses, and text remain readable`, verifications: [
    { spec: 'All five opponent seats remain visible', check: async () => expect(page.getByLabel('Opponents').locator('.opponent-seat')).toHaveCount(5) },
    { spec: 'The local hand contains all eight cards', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).locator('.playing-card')).toHaveCount(8) },
    { spec: `Hand cards are at least ${minimum.hand}px wide`, check: async () => expect((await page.locator('.playing-card').first().boundingBox())!.width).toBeGreaterThanOrEqual(minimum.hand) },
    { spec: `The Round art is at least ${minimum.round}px wide`, check: async () => expect((await page.locator('.round-art').boundingBox())!.width).toBeGreaterThanOrEqual(minimum.round) },
    { spec: `Opponent Princesses are at least ${minimum.princess}px wide`, check: async () => expect((await page.locator('.opponent-seat .princess-card').first().boundingBox())!.width).toBeGreaterThanOrEqual(minimum.princess) },
    { spec: 'Every opponent Princess still exposes readable power copy', check: async () => expect(page.locator('.opponent-seat .seat-princess > span')).toHaveCount(5) }
  ] });

  steps.generateDocs();
  await closeRoundCardGame(game);
});
