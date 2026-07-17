import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'SIS00034', desktop: 'SIS10034' } as const;

test('Sisterhood visibly awards the card farthest from the lead value', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Sisterhood', 'Play a complete trick through clicks, compare each visible value with the lead, and open the mathematically correct winner’s captured trick.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Sisterhood', undefined, [], { steps, direction: 'right', count: 2 });
  await steps.step('sisterhood-ready', { description: 'The center announces that numerical distance from the lead—not ordinary high rank—wins', verifications: [
    { spec: 'The exact distance rule is readable', check: async () => expect(page.getByText('The card farthest from the led number wins; if every follower is void, use the farthest value in any suit.')).toBeVisible() },
    { spec: 'The leader has an enabled card', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  const plays = [await clickCurrentCard(game.players)];
  await steps.step('sisterhood-led', { description: `${plays[0].actor} leads ${plays[0].card}; its printed value becomes the distance origin`, verifications: [
    { spec: 'The exact lead graphic is visible', check: async () => expect(page.getByLabel(`${plays[0].actor} played ${plays[0].card}`)).toBeVisible() },
    { spec: 'The next clockwise player has legal choices', check: async () => expect.poll(async () => (await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count()))).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0) }
  ] });
  plays.push(await clickCurrentCard(game.players), await clickCurrentCard(game.players));
  const [leadSuit, leadValueText] = plays[0].card.split(' '); const leadValue = Number(leadValueText);
  const suited = plays.filter((play) => play.card.startsWith(`${leadSuit} `)); const candidates = suited.length > 1 ? suited : plays;
  const winner = candidates.reduce((best, play) => {
    const value = Number(play.card.split(' ')[1]); const bestValue = Number(best.card.split(' ')[1]);
    const distance = Math.abs(value - leadValue); const bestDistance = Math.abs(bestValue - leadValue);
    return distance > bestDistance || (distance === bestDistance && value > bestValue) ? play : best;
  });
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1');
  await steps.step('sisterhood-resolved', { description: `The three cards reveal together; ${winner.card} is farthest from ${leadValue} and ${winner.actor} receives the trick`, verifications: [
    { spec: 'All three exact cards are visible during collection', check: async () => { for (const play of plays) await expect(page.getByLabel(`${play.actor} played ${play.card}`)).toBeVisible(); } },
    { spec: `Only ${winner.actor} has one trick`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') }
  ] });
  await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('sisterhood-reviewed', { description: `${winner.actor} opens the awarded cards so every value can be checked against the lead`, verifications: [
    { spec: 'The review contains every played card', check: async () => { const review = page.getByLabel(`${winner.actor} last trick`); for (const play of plays) await expect(review.getByLabel(play.card, { exact: true })).toBeVisible(); } },
    { spec: 'The winner counter remains one', check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
