import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'HAG00038', desktop: 'HAG10038' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Haggle with the Hag swaps a clicked hand card for a legal captured card', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Haggle with the Hag', 'Complete a trick, select an offer in the winner’s real hand, take an opponent’s played card, and inspect both sides of the exchange.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Haggle with the Hag', undefined, [], { steps, direction: 'left', count: 1 });
  await steps.step('haggle-ready', { description: 'The round card explains that a winner may trade for a captured card other than their own play', verifications: [
    { spec: 'The exact swap restriction is readable', check: async () => expect(page.getByText('A trick winner may show and swap a card from their hand for any card in the trick except the card they played.')).toBeVisible() },
    { spec: 'No haggle controls appear before a trick is won', check: async () => expect(page.getByRole('group', { name: 'Haggle with the Hag' })).toHaveCount(0) }
  ] });
  const played = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  const winnerIndex = (await Promise.all(names.map(async (name) => await page.getByLabel(`${name} tricks`).textContent()))).findIndex((count) => count === '1');
  const winner = names[winnerIndex]; const winnerPage = game.players[winnerIndex];
  await steps.step('haggle-winner-chooses', { description: `${winner} wins the visible trick and receives the exclusive offer-or-decline controls`, verifications: [
    { spec: 'Only the winner sees Haggle controls', check: async () => { await expect(winnerPage.getByRole('group', { name: 'Haggle with the Hag' })).toBeVisible(); for (const [index, player] of game.players.entries()) if (index !== winnerIndex) await expect(player.getByRole('group', { name: 'Haggle with the Hag' })).toHaveCount(0); } },
    { spec: 'All other clients explicitly wait for the winner', check: async () => { for (const [index, player] of game.players.entries()) if (index !== winnerIndex) await expect(player.getByRole('alert')).toContainText(`Waiting for ${winner} to haggle`); } }
  ] });
  const offerButton = winnerPage.getByRole('region', { name: 'Your hand' }).getByRole('button').first(); const offered = await offerButton.getAttribute('aria-label') ?? ''; await offerButton.click();
  const controls = winnerPage.getByRole('group', { name: 'Haggle with the Hag' }); const choices = controls.getByRole('button', { name: /^Take / });
  await steps.step('haggle-offer-selected', { description: `${winner} clicks ${offered} as the visible offer; the two opponent-played cards become the only legal takes`, verifications: [
    { spec: 'The offer is named in the controls', check: async () => expect(controls).toContainText(`Offer ${offered}`) },
    { spec: 'Exactly two take buttons exclude the winner’s own played card', check: async () => expect(choices).toHaveCount(2) }
  ] });
  const takeButton = choices.first(); const taken = (await takeButton.textContent() ?? '').replace(/^Take /, ''); await takeButton.click();
  await expect(winnerPage.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: taken, exact: true })).toBeVisible();
  await page.getByLabel(`${winner} tricks`).click();
  await steps.step('haggle-swapped', { description: `${winner} takes ${taken} into hand and ${offered} replaces it in the captured trick`, verifications: [
    { spec: 'The taken card is now in the winner’s hand and the offer is gone', check: async () => { const hand = winnerPage.getByRole('region', { name: 'Your hand' }); await expect(hand.getByRole('button', { name: taken, exact: true })).toBeVisible(); await expect(hand.getByRole('button', { name: offered, exact: true })).toHaveCount(0); } },
    { spec: 'The captured review contains the offered card instead of the taken card', check: async () => { const review = page.getByLabel(`${winner} last trick`); await expect(review.getByLabel(offered, { exact: true })).toBeVisible(); await expect(review.getByLabel(taken, { exact: true })).toHaveCount(0); } },
    { spec: 'The winner can now lead the next trick', check: async () => expect(winnerPage.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  expect(played.some((play) => play.card === taken)).toBe(true);
  steps.generateDocs(); await closeRoundCardGame(game);
});
