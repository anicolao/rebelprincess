import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'ABR00029', desktop: 'ABR10029' } as const;

test('Always the Bridesmaid visibly awards the second-highest led-suit card', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Always the Bridesmaid', 'Play a complete visible trick and prove the second-highest card—not the highest—takes it.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Always the Bridesmaid', undefined, [], { steps, direction: 'right', count: 1 });
  await steps.step('bridesmaid-ready', { description: 'The center announces the second-highest winning rule before anyone plays', verifications: [
    { spec: 'The exact rule is readable', check: async () => expect(page.getByText('The second-highest card of the led suit wins; if every follower is void, the leader wins.')).toBeVisible() },
    { spec: 'The leader has a playable card', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  const plays = [await clickCurrentCard(game.players)];
  await steps.step('bridesmaid-led', { description: `${plays[0].actor} leads ${plays[0].card}, making its suit the one that matters`, verifications: [
    { spec: 'The exact lead is visible at the table center', check: async () => expect(page.getByLabel(`${plays[0].actor} played ${plays[0].card}`)).toBeVisible() },
    { spec: 'The next player is prompted through the normal UI', check: async () => expect.poll(async () => game.players.reduce(async (total, player) => (await total) + await player.locator('.playing-card.playable:not(:disabled)').count(), Promise.resolve(0))).toBeGreaterThan(0) }
  ] });
  plays.push(await clickCurrentCard(game.players), await clickCurrentCard(game.players));
  const suit = plays[0].card.split(' ')[0];
  const eligible = plays.filter((play) => play.card.startsWith(`${suit} `));
  expect(eligible.length, 'the narrative seed must produce at least two led-suit cards').toBeGreaterThanOrEqual(2);
  const ranked = [...eligible].sort((a, b) => Number(b.card.split(' ')[1]) - Number(a.card.split(' ')[1]));
  const winner = ranked[1];
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1');
  await steps.step('bridesmaid-complete', { description: `The completed trick increments ${winner.actor} rather than the player of the highest card`, verifications: [
    { spec: `The trick counter awards ${winner.actor}`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') },
    { spec: 'Every other player remains at zero tricks', check: async () => { for (const actor of ['Alex', 'Jo', 'Sam'].filter((actor) => actor !== winner.actor)) await expect(page.getByLabel(`${actor} tricks`)).toHaveText('0'); } }
  ] });
  await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('bridesmaid-awarded', { description: `${winner.actor} opens all three captured cards: ${ranked[0].card} is highest, but ${winner.card} is the second-highest winner`, verifications: [
    { spec: 'The review contains the highest card that deliberately lost', check: async () => expect(page.getByLabel(`${winner.actor} last trick`).getByLabel(ranked[0].card, { exact: true })).toBeVisible() },
    { spec: 'The review contains the second-highest winning card', check: async () => expect(page.getByLabel(`${winner.actor} last trick`).getByLabel(winner.card, { exact: true })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
