import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'BLF00039', desktop: 'BLF10039' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Blind Man’s Bluff rotates each unplayed half to the player on its right', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Blind Man’s Bluff', 'Play the first six cards normally, inventory every remaining card, prove the exact clockwise transfer, then play the borrowed halves to round end.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Blind Man’s Bluff');
  await steps.step('bluff-ready', { description: 'The center announces that each second half will be played by the player on its owner’s right', verifications: [
    { spec: 'The exact half-hand rule is readable', check: async () => expect(page.getByText('Play half your hand, then give the other half to the player on your right for them to play.')).toBeVisible() },
    { spec: 'Every player begins with twelve cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } }
  ] });
  for (let play = 0; play < 15; play += 1) await clickCurrentCard(game.players);
  const seven = await Promise.all(game.players.map(async (player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  await steps.step('bluff-one-left', { description: 'After five tricks, every owner has seven cards; one more played card will identify the exact six-card half to transfer', verifications: [
    { spec: 'Every hand visibly contains seven cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(7); } },
    { spec: 'Trick six is announced', check: async () => expect(page.getByRole('alert')).toContainText('Trick 6') }
  ] });
  const sixth = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  const remaining = Object.fromEntries(names.map((name, index) => [name, seven[index].filter((label) => label !== sixth.find((play) => play.actor === name)?.card)]));
  await steps.step('bluff-passed-right', { description: 'The sixth trick triggers the automatic handoff: Alex receives Jo’s six, Jo receives Sam’s six, and Sam receives Alex’s six', verifications: [
    { spec: 'The center confirms the second hands passed right', check: async () => expect(page.getByText('Blind Man’s Bluff · second hands passed right', { exact: true })).toBeVisible() },
    { spec: 'Alex has Jo’s exact remaining cards', check: async () => { const hand = page.getByRole('region', { name: 'Your hand' }); for (const label of remaining.Jo) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible(); } },
    { spec: 'Jo has Sam’s exact remaining cards', check: async () => { const hand = game.jo.getByRole('region', { name: 'Your hand' }); for (const label of remaining.Sam) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible(); } },
    { spec: 'Sam has Alex’s exact remaining cards', check: async () => { const hand = game.sam.getByRole('region', { name: 'Your hand' }); for (const label of remaining.Alex) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible(); } }
  ] });
  for (let play = 18; play < 36; play += 1) await clickCurrentCard(game.players);
  await steps.step('bluff-complete', { description: 'All eighteen borrowed-card clicks complete the final six tricks and reveal normal scoring', verifications: [
    { spec: 'All borrowed hands are empty', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'Round one scoring is visible', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
