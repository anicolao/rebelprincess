import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const CASES = {
  phone: { id: 'QR000067', dealSeed: 'PR000067', lead: 'Pets 7' },
  desktop: { id: 'ER000090', dealSeed: 'DR000090', lead: 'Pets 3' }
} as const;

test('Royal Decree visibly awards a trick to an off-suit Queen', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Royal Decree', 'Lead a Pet, click an off-suit Queen, complete the trick, and open Jo’s awarded cards to prove Queens are trump.');
  const chosen = CASES[testInfo.project.name as keyof typeof CASES]; const game = await setupRoundCardGame(browser, page, testInfo, chosen.id, 'Royal Decree', chosen.dealSeed, [], { steps, direction: 'right', count: 3 });
  await steps.step('decree-ready', { description: `Royal Decree is visible before Alex leads ${chosen.lead}`, verifications: [
    { spec: 'The center states that Queens always win', check: async () => expect(page.getByText('Queens always win the trick; the highest Queen wins if several are played.')).toBeVisible() },
    { spec: `${chosen.lead} is a legal non-Queen lead`, check: async () => expect(page.getByRole('button', { name: chosen.lead, exact: true })).toBeEnabled() }
  ] });
  await page.getByRole('button', { name: chosen.lead, exact: true }).click(); await expect(page.getByLabel(`Alex played ${chosen.lead}`)).toBeVisible();
  await steps.step('decree-pet-led', { description: `Alex clicks ${chosen.lead}, establishing Pets as the ordinary led suit`, verifications: [
    { spec: 'The Pet graphic is alone in the center', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(1) },
    { spec: 'Jo is void and receives the next turn', check: async () => expect(game.jo.getByRole('alert')).toContainText('Your turn') }
  ] });
  const queen = game.jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Queens / }).first(); const queenLabel = await queen.getAttribute('aria-label') ?? ''; await queen.click(); await expect(page.getByLabel(`Jo played ${queenLabel}`)).toBeVisible();
  await steps.step('decree-queen-played', { description: `Jo clicks off-suit ${queenLabel}; its Queen graphic remains visible beside the Pet lead`, verifications: [
    { spec: 'The center shows both exact cards', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(2) },
    { spec: 'Sam receives the final turn', check: async () => expect(game.sam.getByRole('alert')).toContainText('Your turn') }
  ] });
  await clickCurrentCard(game.players); await expect(page.getByLabel('Jo tricks')).toHaveText('1'); await page.getByLabel('Jo tricks').click();
  await steps.step('decree-queen-wins', { description: `Jo’s awarded review proves ${queenLabel} trumped the led Pet`, verifications: [
    { spec: 'Jo has exactly one captured trick', check: async () => expect(page.getByLabel('Jo tricks')).toHaveText('1') },
    { spec: 'The open review includes Jo’s Queen and Alex’s Pet', check: async () => { const review = page.getByLabel('Jo last trick'); await expect(review.getByLabel(queenLabel, { exact: true })).toBeVisible(); await expect(review.getByLabel(chosen.lead, { exact: true })).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
