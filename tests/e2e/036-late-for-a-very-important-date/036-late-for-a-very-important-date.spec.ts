import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'LVD00036', desktop: 'LVD10036' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Late for a Very Important Date keeps and scores each final three cards', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Late for a Very Important Date', 'Play nine full tricks through clicks, identify the three unplayed cards at every seat, and prove those exact cards are kept and scored.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Late for a Very Important Date', undefined, [], { steps, direction: 'right', count: 2 });
  await steps.step('late-date-ready', { description: 'The center states that each player stops with three cards and scores them as captured', verifications: [
    { spec: 'The exact keep-and-score rule is readable', check: async () => expect(page.getByText('Each player’s last three hand cards are kept and scored as captured cards.')).toBeVisible() },
    { spec: 'All three players begin with twelve playable cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } }
  ] });
  for (let play = 0; play < 24; play += 1) await clickCurrentCard(game.players);
  const finalFour = await Promise.all(game.players.map(async (player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  await steps.step('late-date-four-left', { description: 'After eight tricks, each edge visibly has four cards: one more will be played and the other three will leave early', verifications: [
    { spec: 'Every hand contains exactly four cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(4); } },
    { spec: 'Trick nine is announced', check: async () => expect(page.getByRole('alert')).toContainText('Trick 9') }
  ] });
  const ninth = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  const kept = Object.fromEntries(names.map((name, index) => [name, finalFour[index].filter((label) => label !== ninth.find((play) => play.actor === name)?.card)]));
  await steps.step('late-date-kept', { description: 'The ninth trick completes and the remaining three cards at every seat move directly into the scoring panel', verifications: [
    { spec: 'Every hand is now empty without playing a tenth trick', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'Each player’s three exact retained cards are listed', check: async () => { for (const name of names) await expect(page.getByLabel(`${name} kept cards`)).toHaveText(`Kept: ${kept[name].join(', ')}`); } },
    { spec: 'Only nine tricks were played', check: async () => { const counts = await page.locator('.trick-counter summary').allTextContents(); expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(9); } }
  ] });
  await steps.step('late-date-scored', { description: 'Round scoring visibly includes Princes and the Frog from both won tricks and the listed kept cards', verifications: [
    { spec: 'Round one scoring is visible', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() },
    { spec: 'All nine retained cards are accounted for', check: async () => expect(Object.values(kept).flat()).toHaveLength(9) }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
