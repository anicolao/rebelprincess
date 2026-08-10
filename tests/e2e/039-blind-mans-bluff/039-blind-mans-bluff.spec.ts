import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'BLF00039', desktop: 'BLF10039' } as const;
const allNames = ['Alex', 'Jo', 'Sam', 'Bea', 'Cleo'];

test('Blind Man’s Bluff rotates each unplayed half to the player on its right', async ({ page, browser }, testInfo) => {
  const names = testInfo.project.name === 'phone' ? allNames.slice(0, 3) : allNames;
  const originalHandSize = names.length === 3 ? 12 : 8;
  const transferAfterTricks = originalHandSize / 2;
  const transferredHandSize = originalHandSize / 2;
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Blind Man’s Bluff', 'Play half of the original deal, prove the exact clockwise transfer at a five-player desktop table, and keep the compact three-player phone scenario covered.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Blind Man’s Bluff', undefined, [], { steps, direction: 'right', count: 1 }, names);
  const play = () => clickCurrentCard(game.players, false, names);
  await steps.step('bluff-ready', { description: 'The center announces that each second half will be played by the player on its owner’s right', verifications: [
    { spec: 'The original-deal threshold is readable', check: async () => expect(page.getByText('After playing half the number of cards originally dealt to you, give your remaining hand to the player on your right to play.')).toBeVisible() },
    { spec: `Every player begins with ${originalHandSize} cards`, check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(originalHandSize); } }
  ] });
  for (let card = 0; card < (transferAfterTricks - 1) * names.length; card += 1) await play();
  const handsBeforeFinalTrick = await Promise.all(game.players.map(async (player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  await steps.step('bluff-one-left', { description: `After ${transferAfterTricks - 1} tricks, every owner has ${transferredHandSize + 1} cards; one more played card will identify the exact ${transferredHandSize}-card half to transfer`, verifications: [
    { spec: `Every hand visibly contains ${transferredHandSize + 1} cards`, check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(transferredHandSize + 1); } },
    { spec: `Trick ${transferAfterTricks} is announced`, check: async () => expect(page.getByRole('alert')).toContainText(`Trick ${transferAfterTricks}`) }
  ] });
  const fourth: Array<{ actor: string; card: string }> = [];
  for (let card = 0; card < names.length; card += 1) fourth.push(await play());
  const remaining = Object.fromEntries(names.map((name, index) => [name, handsBeforeFinalTrick[index].filter((label) => label !== fourth.find((entry) => entry.actor === name)?.card)]));
  await steps.step('bluff-passed-right', { description: `Trick ${transferAfterTricks} triggers the automatic handoff of every original ${transferredHandSize}-card half to the player on its owner’s right`, verifications: [
    { spec: 'The center confirms the second hands passed right', check: async () => expect(page.getByText('Blind Man’s Bluff · second hands passed right', { exact: true })).toBeVisible() },
    { spec: 'Every player receives the next seated player’s exact remaining cards', check: async () => {
      for (const [index, player] of game.players.entries()) {
        const source = names[(index + 1) % names.length];
        const hand = player.getByRole('region', { name: 'Your hand' });
        await expect(hand.getByRole('button')).toHaveCount(transferredHandSize);
        for (const label of remaining[source]) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
    } }
  ] });
  for (let card = 0; card < transferredHandSize * names.length; card += 1) await play();
  await steps.step('bluff-complete', { description: `All ${transferredHandSize * names.length} borrowed-card clicks complete the final ${transferredHandSize} tricks and reveal normal scoring`, verifications: [
    { spec: 'All borrowed hands are empty', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'Round one scoring is visible', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
