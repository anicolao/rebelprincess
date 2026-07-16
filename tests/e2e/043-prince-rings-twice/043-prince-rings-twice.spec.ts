import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'RNG00043', desktop: 'RNG10043' } as const;

test('The Prince Always Rings Twice plays and scores two clockwise laps per trick', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('The Prince Always Rings Twice', 'Play one complete six-card trick in two visible laps, independently total the leading suit, inspect the winner’s six cards, and finish all six tricks.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Prince Always Rings Twice');
  await steps.step('rings-ready', { description: 'The center announces two cards per player, summed only in the leading suit with a highest-card tie-break', verifications: [
    { spec: 'The exact double-play rule is readable', check: async () => expect(page.getByText('Everyone plays two cards per trick. Add leading-suit values to find the winner; highest leading-suit card breaks ties.')).toBeVisible() },
    { spec: 'All players begin with twelve cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } }
  ] });
  const plays = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('rings-first-lap', { description: `The first clockwise lap places ${plays.map((play) => play.card).join(', ')} in the center without resolving the trick`, verifications: [
    { spec: 'Three actual card graphics remain in the current trick', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(3) },
    { spec: 'No trick counter increments after only one lap', check: async () => { for (const name of ['Alex', 'Jo', 'Sam']) await expect(page.getByLabel(`${name} tricks`)).toHaveText('0'); } }
  ] });
  plays.push(await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players));
  const ledSuit = plays[0].card.split(' ')[0]; const totals = new Map<string, { total: number; high: number }>();
  for (const play of plays) { const value = Number(play.card.split(' ')[1]); const score = totals.get(play.actor) ?? { total: 0, high: 0 }; if (play.card.startsWith(`${ledSuit} `)) { score.total += value; score.high = Math.max(score.high, value); } totals.set(play.actor, score); }
  const winner = [...totals].reduce((best, entry) => entry[1].total > best[1].total || (entry[1].total === best[1].total && entry[1].high > best[1].high) ? entry : best)[0];
  await expect(page.getByLabel(`${winner} tricks`)).toHaveText('1');
  await steps.step('rings-second-lap', { description: `The second lap completes six cards; ${winner} has the greatest ${ledSuit} sum (then highest-card tie-break) and receives the trick`, verifications: [
    { spec: 'All six graphics are visible during collection', check: async () => { for (const play of plays) await expect(page.getByLabel(`${play.actor} played ${play.card}`)).toBeVisible(); } },
    { spec: `The trick counter awards ${winner}`, check: async () => expect(page.getByLabel(`${winner} tricks`)).toHaveText('1') }
  ] });
  await page.getByLabel(`${winner} tricks`).click();
  await steps.step('rings-reviewed', { description: `${winner} opens the six-card capture so both cards from every player can be recomputed`, verifications: [
    { spec: 'The review contains all six played cards', check: async () => { const review = page.getByLabel(`${winner} last trick`); for (const play of plays) await expect(review.getByLabel(play.card, { exact: true })).toBeVisible(); } },
    { spec: 'Each hand has ten cards after two plays', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(10); } }
  ] });
  for (let play = 6; play < 36; play += 1) await clickCurrentCard(game.players);
  await steps.step('rings-complete', { description: 'Five more six-card tricks consume all hands and reveal normal round scoring', verifications: [
    { spec: 'Exactly six tricks were awarded', check: async () => { const counts = await page.locator('.trick-counter summary').allTextContents(); expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(6); } },
    { spec: 'Round one scoring is visible', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
