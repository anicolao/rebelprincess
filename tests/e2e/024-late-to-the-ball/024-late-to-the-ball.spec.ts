import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'RLB00001', desktop: 'RLB00002' } as const;

test('Late to the Ball reserves and plays the final card entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Late to the Ball', 'Each player clicks a reserved card, plays every ordinary trick, then sees and clicks that exact card in the final trick.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Late to the Ball');
  await steps.step('reserve-prompt', { description: 'After passing, every player is prompted to reserve one card for the final trick', verifications: [
    { spec: 'The Round rule is printed in the center', check: async () => expect(page.getByText('After passing, set aside one card face down. It must be played normally in the final trick.')).toBeVisible() },
    { spec: 'All clients receive the reserve prompt before anyone can lead', check: async () => { for (const player of game.players) await expect(player.getByRole('alert')).toContainText('Choose one card to reserve'); } }
  ] });
  const reserved: string[] = [];
  for (const player of game.players) { const card = player.getByRole('region', { name: 'Your hand' }).getByRole('button').last(); reserved.push(await card.getAttribute('aria-label') ?? ''); await card.click(); }
  await steps.step('cards-reserved', { description: 'All three card clicks resolve simultaneously and ordinary trick play begins', verifications: [
    { spec: 'Each hand has eleven playable-round cards remaining', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } },
    { spec: 'Alex receives the first ordinary turn', check: async () => expect(page.getByRole('alert')).toContainText('Your turn') }
  ] });
  for (let play = 0; play < 33; play += 1) await clickCurrentCard(game.players);
  await steps.step('reserved-cards-return', { description: `The final hands reveal the exact reserved cards: ${reserved.join(', ')}`, verifications: [
    { spec: 'Every player has exactly their reserved card', check: async () => { for (const [index, player] of game.players.entries()) { const hand = player.getByRole('region', { name: 'Your hand' }); await expect(hand.getByRole('button')).toHaveCount(1); await expect(hand.getByRole('button', { name: reserved[index], exact: true })).toBeVisible(); } } },
    { spec: 'The status identifies the twelfth and final trick', check: async () => expect(page.getByRole('alert')).toContainText('Trick 12') }
  ] });
  const final = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('reserved-final-trick', { description: `The three reserved graphics are clicked into the final trick: ${final.map((play) => play.card).join(', ')}`, verifications: [
    { spec: 'All hands are empty after the reserved cards are played', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'The round reaches its visible scoring result', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
