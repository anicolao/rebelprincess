import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CCI00009', desktop: 'CCI0000C' } as const;

test('Cinderella reverses a trick entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Cinderella click activation', 'Click Cinderella, then click every card in the reversed trick.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Cinderella');
  const princess = page.getByRole('button', { name: 'Use Cinderella power' });
  await steps.step('cinderella-ready', { description: 'Cinderella is available before the trick', verifications: [
    { spec: 'The Princess card is an enabled button', check: async () => expect(princess).toBeEnabled() },
    { spec: 'No Princess power is active yet', check: async () => expect(page.getByText('Princess power: Cinderella')).toHaveCount(0) }
  ] });
  await expect(princess).toBeEnabled(); await princess.click();
  await expect(page.getByText('Princess power: Cinderella')).toBeVisible();
  await expect(game.jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/);
  await steps.step('cinderella-clicked', { description: 'Clicking Cinderella activates the reversed trick', verifications: [
    { spec: 'The active power is exposed as shared status text', check: async () => expect(page.getByText('Princess power: Cinderella')).toBeVisible() },
    { spec: 'Observer projection records Cinderella as exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/) }
  ] });
  const plays: string[] = [];
  plays.push(await playOneClick(game.players));
  await steps.step('cinderella-lead-played', { description: `Alex leads ${plays[0]} into Cinderella’s reversed trick`, verifications: [
    { spec: 'The center contains exactly the lead card record', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(1) },
    { spec: 'The active Cinderella rule remains visible', check: async () => expect(page.getByText('Princess power: Cinderella')).toBeVisible() }
  ] });
  plays.push(await playOneClick(game.players));
  await steps.step('cinderella-second-card-played', { description: `Jo follows with ${plays[1]} and both ranks remain visible`, verifications: [
    { spec: 'The center contains two played card records', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(2) },
    { spec: 'Both exact card graphics are labelled in the trick', check: async () => { await expect(page.getByLabel(`Alex played ${plays[0]}`)).toBeVisible(); await expect(page.getByLabel(`Jo played ${plays[1]}`)).toBeVisible(); } }
  ] });
  plays.push(await playOneClick(game.players));
  const names = ['Alex', 'Jo', 'Sam'];
  const ledSuit = plays[0].split(' ')[0];
  const eligible = plays.map((card, index) => ({ card, index, suit: card.split(' ')[0], rank: Number(card.split(' ')[1]) })).filter((play) => play.suit === ledSuit);
  const lowest = eligible.reduce((winner, play) => play.rank < winner.rank ? play : winner);
  const winnerName = names[lowest.index];
  await page.getByLabel(`${winnerName} tricks`).click();
  await steps.step('cinderella-lowest-card-wins', { description: `${winnerName} takes the reversed trick with the lowest led-suit card, ${lowest.card}`, verifications: [
    { spec: 'The winner’s open review contains all three played card records', check: async () => { const review = page.getByLabel(`${winnerName} last trick`); await expect(review).toBeVisible(); await expect(review.locator('.review-card')).toHaveCount(3); } },
    { spec: 'The reviewed cards exactly match the three clicked plays', check: async () => { const labels = await page.getByLabel(`${winnerName} last trick`).locator('.review-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label'))); expect(labels).toEqual(plays); } },
    { spec: `${lowest.card} is the lowest card of the led suit`, check: async () => expect(eligible.every((play) => lowest.rank <= play.rank)).toBe(true) },
    { spec: 'All clients see Cinderella exhausted', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(game.sam.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/); } },
    { spec: `${winnerName} has one awarded trick`, check: async () => expect(page.getByLabel(`${winnerName} tricks`)).toHaveText('1') }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
