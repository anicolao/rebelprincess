import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'UPS00046', desktop: 'UPS10046' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Upside Down toggles rank direction for every clicked 6', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Upside Down', 'Reach and click an actual legal 6, observe the low-card direction, complete that trick, and calculate the winner from visible 6 parity.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Upside Down', undefined, [], { steps, direction: 'left', count: 2 });
  await steps.step('upside-ready', { description: 'The center announces that each 6 flips the ranking and a second 6 flips it back', verifications: [
    { spec: 'The exact toggle rule is readable', check: async () => expect(page.getByText('Each 6 played reverses the card ranking for that trick; a second 6 reverses it again.')).toBeVisible() },
    { spec: 'No reversal status appears before a 6', check: async () => expect(page.getByText('Upside Down · low cards currently win', { exact: true })).toHaveCount(0) }
  ] });
  let current: Array<{ actor: string; card: string }> = []; let sixIndex = -1; let sixLabel = ''; let beforeCounts: Record<string, number> = {};
  for (let attempt = 0; attempt < 36 && sixIndex < 0; attempt += 1) {
    const counts = await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)[aria-label$=" 6"]').count())); sixIndex = counts.findIndex(Boolean);
    if (sixIndex >= 0 && current.length < 2) { beforeCounts = Object.fromEntries(await Promise.all(names.map(async (name) => [name, Number(await page.getByLabel(`${name} tricks`).textContent() ?? 0)]))); const six = game.players[sixIndex].locator('.playing-card.playable:not(:disabled)[aria-label$=" 6"]').first(); sixLabel = await six.getAttribute('aria-label') ?? ''; await six.click(); current.push({ actor: names[sixIndex], card: sixLabel }); break; }
    sixIndex = -1;
    current.push(await clickCurrentCard(game.players)); if (current.length === 3) current = [];
  }
  expect(sixIndex, 'a 6 must become legal before the round ends').toBeGreaterThanOrEqual(0);
  await steps.step('upside-six-led', { description: `${names[sixIndex]} clicks ${sixLabel}; an odd 6 immediately changes the table to low-card-wins`, verifications: [
    { spec: 'The actual 6 graphic is visible', check: async () => expect(page.getByLabel(`${names[sixIndex]} played ${sixLabel}`)).toBeVisible() },
    { spec: 'The center explicitly shows the reversed direction', check: async () => expect(page.getByText('Upside Down · low cards currently win', { exact: true })).toBeVisible() }
  ] });
  while (current.length < 3) current.push(await clickCurrentCard(game.players)); const plays = current;
  const sixCount = plays.filter((play) => play.card.endsWith(' 6')).length; const reversed = sixCount % 2 === 1; const ledSuit = plays[0].card.split(' ')[0]; const eligible = plays.filter((play) => play.card.startsWith(`${ledSuit} `));
  const winner = eligible.reduce((best, play) => reversed ? Number(play.card.split(' ')[1]) < Number(best.card.split(' ')[1]) ? play : best : Number(play.card.split(' ')[1]) > Number(best.card.split(' ')[1]) ? play : best);
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText(String(beforeCounts[winner.actor] + 1));
  await steps.step('upside-resolved', { description: `${sixCount} visible 6${sixCount === 1 ? '' : 's'} leave${sixCount === 1 ? 's' : ''} ranking ${reversed ? 'reversed' : 'normal'}; ${winner.card} therefore wins the led suit`, verifications: [
    { spec: 'All three exact graphics are visible during collection', check: async () => { for (const play of plays) await expect(page.getByLabel(`${play.actor} played ${play.card}`)).toBeVisible(); } },
    { spec: `The trick counter increments ${winner.actor}`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText(String(beforeCounts[winner.actor] + 1)) }
  ] });
  await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('upside-reviewed', { description: `${winner.actor} opens the captured cards so the 6 parity and final rank direction can be reviewed`, verifications: [
    { spec: 'The captured review contains every played card', check: async () => { const review = page.getByLabel(`${winner.actor} last trick`); for (const play of plays) await expect(review.getByLabel(play.card, { exact: true })).toBeVisible(); } },
    { spec: 'The next trick resets to normal ranking', check: async () => expect(page.getByText('Upside Down · low cards currently win', { exact: true })).toHaveCount(0) }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
