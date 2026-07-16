import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'PET00032', desktop: 'PET10032' } as const;

test('Pets’ Revenge scores every Pet after a complete UI-played round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Pets’ Revenge', 'Count the nine Pets in the shared deal, play all twelve tricks through card clicks, and reconcile every Pet in the scoring panel.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Pets’ Revenge');
  const petLocators = game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Pets / }));
  await steps.step('pets-ready', { description: 'The round begins with all nine three-player Pets present and a visible one-proposal rule', verifications: [
    { spec: 'The exact Pet scoring rule is readable', check: async () => expect(page.getByText('At the end of the round, every Pet scores one proposal, including the Frog.')).toBeVisible() },
    { spec: 'The shared deal contains exactly nine Pets', check: async () => expect((await Promise.all(petLocators.map((cards) => cards.count()))).reduce((sum, count) => sum + count, 0)).toBe(9) }
  ] });
  const first = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('pets-first-trick', { description: `The first trick is played normally with the actual graphics: ${first.map((play) => play.card).join(', ')}`, verifications: [
    { spec: 'Exactly one player receives the first trick', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) },
    { spec: 'Every hand now contains eleven cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } }
  ] });
  for (let play = 3; play < 36; play += 1) await clickCurrentCard(game.players);
  const scoring = page.getByRole('region', { name: 'Round 1 scoring' });
  const rows = await scoring.locator('li span').allTextContents();
  await steps.step('pets-scored', { description: 'After all 36 card clicks, the three visible Round-rule modifiers reconcile to all nine captured Pets', verifications: [
    { spec: 'All hands are empty after twelve complete tricks', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'All nine Pets are counted exactly once', check: async () => expect(rows.reduce((sum, row) => sum + Number(row.match(/\+ (\d+) Round rule/)?.[1] ?? 0), 0)).toBe(9) },
    { spec: 'The round completion alert is visible', check: async () => expect(page.getByRole('alert')).toContainText('Round 1 complete') }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
