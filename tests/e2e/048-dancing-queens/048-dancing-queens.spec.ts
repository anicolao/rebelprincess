import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'DAN00048', desktop: 'DAN10048' } as const;

test('Dancing Queens pairs captured Princes and Queens in complete-round scoring', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Dancing Queens', 'Count every Prince and Queen, play all twelve tricks through real card clicks, and reconcile base Princes, couple bonuses, Frog, and final totals.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Dancing Queens');
  const princeLocators = game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Princes / })); const queenLocators = game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Queens / }));
  await steps.step('dancing-ready', { description: 'The round begins with all nine Princes and nine Queens available for exact-rank and unmatched couples', verifications: [
    { spec: 'The complete couple-scoring rule is readable', check: async () => expect(page.getByText('Matching Prince and Queen values score three proposals each. Unmatched couples score two; an unpaired Prince scores one.')).toBeVisible() },
    { spec: 'The shared deal contains exactly nine Princes and nine Queens', check: async () => { expect((await Promise.all(princeLocators.map((cards) => cards.count()))).reduce((sum, count) => sum + count, 0)).toBe(9); expect((await Promise.all(queenLocators.map((cards) => cards.count()))).reduce((sum, count) => sum + count, 0)).toBe(9); } }
  ] });
  const first = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('dancing-first-trick', { description: `The first of twelve ordinary tricks resolves from visible cards: ${first.map((play) => play.card).join(', ')}`, verifications: [
    { spec: 'Exactly one first trick is awarded', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) },
    { spec: 'Every hand retains eleven cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } }
  ] });
  for (let play = 3; play < 36; play += 1) await clickCurrentCard(game.players);
  const scoring = page.getByRole('region', { name: 'Round 1 scoring' }); const rows = await scoring.locator('li span').allTextContents();
  const basePrinces = rows.reduce((sum, row) => sum + Number(row.match(/^(\d+) Princes/)?.[1] ?? 0), 0); const frog = rows.reduce((sum, row) => sum + Number(row.match(/\+ (\d+) Frog/)?.[1] ?? 0), 0); const bonuses = rows.reduce((sum, row) => sum + Number(row.match(/\+ (\d+) Round rule/)?.[1] ?? 0), 0); const totals = rows.reduce((sum, row) => sum + Number(row.match(/= (-?\d+)/)?.[1] ?? 0), 0);
  await steps.step('dancing-scored', { description: `The final rows account for nine base Princes, ${bonuses} couple bonus proposals, and the five-point Frog`, verifications: [
    { spec: 'Every Prince is counted once before pairing', check: async () => expect(basePrinces).toBe(9) },
    { spec: 'At least one captured couple earns a visible Round-rule bonus', check: async () => expect(bonuses).toBeGreaterThan(0) },
    { spec: 'All row arithmetic reconciles globally', check: async () => { expect(frog).toBe(5); expect(totals).toBe(basePrinces + frog + bonuses); } },
    { spec: 'All hands are empty after the unshortened round', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
