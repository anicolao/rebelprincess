import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'MCH00033', desktop: 'MCH10033' } as const;

test('Musical Chairs passes one clicked card right after every trick', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Musical Chairs', 'Play a complete trick, select the exchange cards one client at a time, observe waiting, and prove each exact card reaches the player on its right.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Musical Chairs');
  await steps.step('chairs-ready', { description: 'The center announces a simultaneous one-card pass to the right after every trick', verifications: [
    { spec: 'The exact exchange rule is readable', check: async () => expect(page.getByText('After every trick, everyone simultaneously passes one card face down to the player on their right.')).toBeVisible() },
    { spec: 'No exchange prompt appears before a trick', check: async () => expect(page.getByText(/Choose one card to pass right/)).toHaveCount(0) }
  ] });
  const trick = [await clickCurrentCard(game.players), await clickCurrentCard(game.players), await clickCurrentCard(game.players)];
  await steps.step('chairs-trick-complete', { description: `The ordinary trick completes (${trick.map((play) => play.card).join(', ')}) and all three clients enter the exchange`, verifications: [
    { spec: 'Every client receives the Musical Chairs prompt', check: async () => { for (const player of game.players) await expect(player.getByRole('alert')).toContainText('Musical Chairs'); } },
    { spec: 'Every client still holds eleven cards before exchanging', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } }
  ] });
  const chosen: string[] = [];
  for (const player of game.players) chosen.push(await player.locator('.playing-card.contributable').first().getAttribute('aria-label') ?? '');
  await game.players[0].getByRole('button', { name: chosen[0], exact: true }).click();
  await steps.step('chairs-host-waits', { description: `Alex clicks ${chosen[0]} face down; it remains hidden while Jo and Sam decide`, verifications: [
    { spec: 'Alex sees the explicit waiting message', check: async () => expect(page.getByRole('alert')).toContainText('Waiting for the other chairs') },
    { spec: 'Jo and Sam still have selectable exchange cards', check: async () => { await expect(game.jo.locator('.playing-card.contributable').first()).toBeVisible(); await expect(game.sam.locator('.playing-card.contributable').first()).toBeVisible(); } }
  ] });
  await game.players[1].getByRole('button', { name: chosen[1], exact: true }).click();
  await game.players[2].getByRole('button', { name: chosen[2], exact: true }).click();
  await steps.step('chairs-exchanged', { description: `The simultaneous reveal resolves clockwise: Alex receives ${chosen[1]}, Jo receives ${chosen[2]}, and Sam receives ${chosen[0]}`, verifications: [
    { spec: 'Alex receives Jo’s exact selected card', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chosen[1], exact: true })).toBeVisible() },
    { spec: 'Jo receives Sam’s exact selected card', check: async () => expect(game.jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chosen[2], exact: true })).toBeVisible() },
    { spec: 'Sam receives Alex’s exact selected card', check: async () => expect(game.sam.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chosen[0], exact: true })).toBeVisible() },
    { spec: 'All hands remain conserved at eleven cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
