import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'CCR00030', desktop: 'CCR10030' } as const;
const names = ['Alex', 'Jo', 'Sam'];

async function chooseFirstSuit(player: Page) {
  const choices = player.getByRole('group', { name: 'Crystal Clear suit choice' });
  const button = choices.getByRole('button').first();
  const suit = await button.textContent() ?? '';
  const cards = await player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: new RegExp(`^${suit[0].toUpperCase()}${suit.slice(1)} `) }).all();
  const labels = await Promise.all(cards.map(async (card) => await card.getAttribute('aria-label') ?? ''));
  await button.click();
  return { suit, labels };
}

test('Crystal Clear reveals a chosen suit and keeps those cards playable', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Crystal Clear', 'Each player chooses through the UI, everyone sees the original revealed cards, and the leader plays one normally.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Crystal Clear');
  await steps.step('crystal-choices', { description: 'After passing, every client is prompted to reveal a suit they actually hold', verifications: [
    { spec: 'The center explains that revealed cards remain in hand', check: async () => expect(page.getByText('Reveal every card of one suit from your hand. They remain in your hand and may be played normally.')).toBeVisible() },
    { spec: 'All three clients have suit-choice buttons', check: async () => { for (const player of game.players) await expect(player.getByRole('group', { name: 'Crystal Clear suit choice' }).getByRole('button').first()).toBeVisible(); } }
  ] });
  const selections: Array<{ suit: string; labels: string[] }> = [];
  for (const player of game.players) selections.push(await chooseFirstSuit(player));
  await expect(page.getByRole('group', { name: "Jo's revealed fairies cards" }).or(page.getByRole('group', { name: new RegExp("Jo's revealed .* cards") }))).toBeVisible();
  await steps.step('crystal-public', { description: `Jo reveals ${selections[1].suit} and Sam reveals ${selections[2].suit}; their exact original cards are face up to Alex`, verifications: [
    { spec: 'Every Jo card selected by the reveal is publicly labelled', check: async () => { const group = page.getByRole('group', { name: new RegExp("Jo's revealed .* cards") }); for (const label of selections[1].labels) await expect(group.getByLabel(label, { exact: true })).toBeVisible(); } },
    { spec: 'Every Sam card selected by the reveal is publicly labelled', check: async () => { const group = page.getByRole('group', { name: new RegExp("Sam's revealed .* cards") }); for (const label of selections[2].labels) await expect(group.getByLabel(label, { exact: true })).toBeVisible(); } }
  ] });
  const leaderIndex = await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count())).then((counts) => counts.findIndex(Boolean));
  const leader = game.players[leaderIndex];
  const selected = selections[leaderIndex];
  const playableRevealed = leader.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: new RegExp(`^${selected.suit[0].toUpperCase()}${selected.suit.slice(1)} `) }).first();
  const played = await playableRevealed.getAttribute('aria-label') ?? '';
  await expect(playableRevealed).toBeEnabled(); await playableRevealed.click();
  await steps.step('crystal-played', { description: `${names[leaderIndex]} clicks the revealed ${played}; revealing gave information but never removed or disabled it`, verifications: [
    { spec: 'The actual revealed card graphic is now in the trick', check: async () => expect(page.getByLabel(`${names[leaderIndex]} played ${played}`)).toBeVisible() },
    { spec: 'The next clockwise player receives a normal turn', check: async () => expect(game.players[(leaderIndex + 1) % 3].getByRole('alert')).toContainText('Your turn') }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
