import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'WED00037', desktop: 'WED10037' } as const;

test('Wedding Gift contributes and awards a face-down card before every trick', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Wedding Gift', 'Contribute gifts one client at a time, prove the first winner captures all six cards, then complete all six gift-and-trick cycles through clicks.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Wedding Gift');
  await steps.step('wedding-ready', { description: 'Before trick one, every client is prompted to put one hand card face down into the gift pile', verifications: [
    { spec: 'The exact gift rule is readable', check: async () => expect(page.getByText('Before each trick, everyone adds one face-down card to a gift pile won with that trick.')).toBeVisible() },
    { spec: 'Every client has selectable gift cards', check: async () => { for (const player of game.players) await expect(player.locator('.playing-card.contributable').first()).toBeVisible(); } }
  ] });
  const gifts = await Promise.all(game.players.map(async (player) => await player.locator('.playing-card.contributable').first().getAttribute('aria-label') ?? ''));
  await page.getByRole('button', { name: gifts[0], exact: true }).click();
  await steps.step('wedding-one-wrapped', { description: `Alex clicks ${gifts[0]} as a face-down gift and waits without exposing it to the table center`, verifications: [
    { spec: 'Alex sees the wrapped waiting state', check: async () => expect(page.getByRole('alert')).toContainText('Gift wrapped · waiting for everyone') },
    { spec: 'No ordinary card can be played while gifts are missing', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)')).toHaveCount(0) }
  ] });
  await game.jo.getByRole('button', { name: gifts[1], exact: true }).click(); await game.sam.getByRole('button', { name: gifts[2], exact: true }).click();
  const played = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  const winner = (await Promise.all(['Alex', 'Jo', 'Sam'].map(async (name) => ({ name, count: await page.getByLabel(`${name} tricks`).textContent() })))).find((entry) => entry.count === '1')!.name;
  await page.getByLabel(`${winner} tricks`).click();
  await steps.step('wedding-first-awarded', { description: `${winner} wins the first trick and opens a six-card capture: three played cards plus all three gifts`, verifications: [
    { spec: 'The review contains every face-down gift', check: async () => { const review = page.getByLabel(`${winner} last trick`); for (const label of gifts) await expect(review.getByLabel(label, { exact: true })).toBeVisible(); } },
    { spec: 'The review also contains every played card', check: async () => { const review = page.getByLabel(`${winner} last trick`); for (const play of played) await expect(review.getByLabel(play.card, { exact: true })).toBeVisible(); } },
    { spec: 'The next Wedding Gift prompt appears before trick two', check: async () => expect(page.getByRole('alert')).toContainText('Wedding Gift') }
  ] });
  for (let trick = 1; trick < 6; trick += 1) {
    for (const player of game.players) await player.locator('.playing-card.contributable').first().click();
    for (let play = 0; play < 3; play += 1) await clickCurrentCard(game.players);
  }
  const rows = await page.getByRole('region', { name: 'Round 1 scoring' }).locator('li span').allTextContents();
  await steps.step('wedding-complete', { description: 'Five more visible gift-and-trick cycles consume all 36 cards and score every Prince plus the Frog normally', verifications: [
    { spec: 'All hands are empty after exactly six tricks', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); const counts = await page.locator('.trick-counter summary').allTextContents(); expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(6); } },
    { spec: 'The three-player deck’s nine Princes and five-point Frog total fourteen proposals', check: async () => expect(rows.reduce((sum, row) => sum + Number(row.match(/= (-?\d+)/)?.[1] ?? 0), 0)).toBe(14) }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
