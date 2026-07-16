import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'ROA00001', desktop: 'ROA00002' } as const;

test('Once Upon a Time plays one complete ordinary trick through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Once Upon a Time', 'Reveal the no-rule teaching card, then click and display all three ordinary plays before reviewing the awarded trick.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Once Upon a Time…', undefined, [], { steps, direction: 'right', count: 3 });
  await steps.step('ordinary-round-ready', { description: 'Once Upon a Time explicitly announces that no special rule changes ordinary play', verifications: [
    { spec: 'The center names the selected Round card', check: async () => expect(page.getByRole('heading', { name: 'Once Upon a Time…' })).toBeVisible() },
    { spec: 'The printed rule says there is no additional rule', check: async () => expect(page.getByText('No additional rule.')).toBeVisible() }
  ] });
  const plays = [await clickCurrentCard(game.players)];
  await steps.step('ordinary-lead', { description: `${plays[0].actor} leads ${plays[0].card} face up`, verifications: [
    { spec: 'The center contains exactly the clicked lead graphic', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(1) },
    { spec: 'The next clockwise player receives the turn', check: async () => expect(game.jo.getByRole('alert')).toContainText('Your turn') }
  ] });
  plays.push(await clickCurrentCard(game.players));
  await steps.step('ordinary-follow', { description: `${plays[1].actor} follows with ${plays[1].card}`, verifications: [
    { spec: 'Both exact played-card graphics remain visible', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(2) },
    { spec: 'The final clockwise player receives the turn', check: async () => expect(game.sam.getByRole('alert')).toContainText('Your turn') }
  ] });
  plays.push(await clickCurrentCard(game.players));
  const names = ['Alex', 'Jo', 'Sam']; await expect.poll(async () => Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).toContain(1);
  const winner = names[(await Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).findIndex((count) => count === 1)];
  await page.getByLabel(`${winner} tricks`).click();
  await steps.step('ordinary-trick-awarded', { description: `${winner}’s awarded trick opens and shows every ordinary play`, verifications: [
    { spec: 'The open review contains all three card graphics', check: async () => expect(page.getByLabel(`${winner} last trick`).locator('.review-card')).toHaveCount(3) },
    { spec: `${winner} has exactly one captured trick`, check: async () => expect(page.getByLabel(`${winner} tricks`)).toHaveText('1') }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
