import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'FAI00042', desktop: 'FAI10042' } as const;

test('Single Fairy subtracts every Fairy after a complete clicked round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Single Fairy', 'Count all Fairies in the shared deal, play every trick through ordinary clicks, and reconcile the complete negative scoring modifier.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Single Fairy', undefined, [], { steps, direction: 'left', count: 1 });
  const fairyLocators = game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Fairies / }));
  await steps.step('fairy-ready', { description: 'The round begins with all nine three-player Fairies and a visible minus-one rule', verifications: [
    { spec: 'The exact negative scoring rule is readable', check: async () => expect(page.getByText('Each captured Fairy removes one proposal; round scores may be negative.')).toBeVisible() },
    { spec: 'The complete shared deal contains exactly nine Fairies', check: async () => expect((await Promise.all(fairyLocators.map((cards) => cards.count()))).reduce((sum, count) => sum + count, 0)).toBe(9) }
  ] });
  const first = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('fairy-first-trick', { description: `The first ordinary trick uses the actual graphics (${first.map((play) => play.card).join(', ')}) before any scoring is applied`, verifications: [
    { spec: 'Exactly one player receives the first trick', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) },
    { spec: 'Every player retains eleven cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } }
  ] });
  for (let play = 3; play < 36; play += 1) await clickCurrentCard(game.players);
  const scoring = page.getByRole('region', { name: 'Round 1 scoring' }); const rows = await scoring.locator('li span').allTextContents();
  await steps.step('fairy-scored', { description: 'After all 36 clicks, the three negative Round-rule entries account for every Fairy and reduce the deck’s base fourteen proposals to five', verifications: [
    { spec: 'All nine Fairies are subtracted exactly once', check: async () => expect(rows.reduce((sum, row) => sum + Number(row.match(/\+ (-\d+) Round rule/)?.[1] ?? 0), 0)).toBe(-9) },
    { spec: 'Combined round totals equal five proposals', check: async () => expect(rows.reduce((sum, row) => sum + Number(row.match(/= (-?\d+)/)?.[1] ?? 0), 0)).toBe(5) },
    { spec: 'All hands are empty after the twelve tricks', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
