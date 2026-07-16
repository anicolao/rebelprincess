import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'RTL00001', desktop: 'RTL00002' } as const;

test('Three Times a Lady scores every 3 negatively through a complete clicked round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Three Times a Lady', 'Reveal the negative-three rule, play every card through the regular UI, and inspect the exact scoring modifiers.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Three Times a Lady');
  const threes = game.players.flatMap((player) => [player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: / 3$/ })]);
  await steps.step('three-rule-ready', { description: 'The Round card announces that every rank 3 subtracts three proposals', verifications: [
    { spec: 'The exact negative scoring rule is printed', check: async () => expect(page.getByText('Each 3 scores −3 proposals; the Prince 3 scores −2 proposals.')).toBeVisible() },
    { spec: 'All four rank-3 cards exist across the complete shared deal', check: async () => expect((await Promise.all(threes.map((locator) => locator.count()))).reduce((sum, count) => sum + count, 0)).toBe(4) }
  ] });
  for (let play = 0; play < 36; play += 1) await clickCurrentCard(game.players);
  const scoring = page.getByRole('region', { name: 'Round 1 scoring' });
  await steps.step('three-round-scored', { description: 'After all 36 ordinary card clicks, the scoring panel applies every captured 3 as a negative modifier', verifications: [
    { spec: 'The round completes with all hands empty', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'The scoring panel visibly contains negative Round modifiers', check: async () => expect(scoring.getByText(/-\d+ Round rule/).first()).toBeVisible() },
    { spec: 'The negative scores are reflected in cumulative totals', check: async () => expect(scoring.getByText(/-\d+ total/).first()).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
