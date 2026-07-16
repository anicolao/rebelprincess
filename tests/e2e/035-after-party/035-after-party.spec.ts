import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'AFT00035', desktop: 'AFT10035' } as const;

async function chooseFirstSix(player: Page) {
  const hand = player.getByRole('region', { name: 'Your hand' }).getByRole('button');
  const labels: string[] = [];
  for (let index = 0; index < 6; index += 1) { const card = hand.nth(index); labels.push(await card.getAttribute('aria-label') ?? ''); await card.click(); }
  return labels;
}

test('After Party plays two user-chosen six-card hands in sequence', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('After Party', 'Choose the first half through ordinary card clicks, synchronize all three splits, exhaust six tricks, pick up the held halves, and finish the round.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'After Party');
  await steps.step('after-party-ready', { description: 'After passing, each client must choose exactly six cards for the first hand', verifications: [
    { spec: 'The center states that halves are played sequentially', check: async () => expect(page.getByText('Split your hand into equal halves. Play the first half before picking up and playing the second.')).toBeVisible() },
    { spec: 'Every client sees a 0/6 first-hand prompt', check: async () => { for (const player of game.players) await expect(player.getByRole('group', { name: 'After Party first hand' })).toContainText('(0/6)'); } }
  ] });
  const alexFirst = await chooseFirstSix(page);
  await steps.step('after-party-six-selected', { description: `Alex clicks six specific cards for the first hand: ${alexFirst.join(', ')}`, verifications: [
    { spec: 'Exactly six cards are visibly selected', check: async () => expect(page.locator('.playing-card.selected')).toHaveCount(6) },
    { spec: 'The Set first hand button becomes enabled', check: async () => expect(page.getByRole('button', { name: 'Set first hand' })).toBeEnabled() }
  ] });
  await page.getByRole('button', { name: 'Set first hand' }).click();
  const joFirst = await chooseFirstSix(game.jo); await game.jo.getByRole('button', { name: 'Set first hand' }).click();
  const samFirst = await chooseFirstSix(game.sam); await game.sam.getByRole('button', { name: 'Set first hand' }).click();
  await steps.step('after-party-split', { description: 'All three submissions resolve together; each table edge now contains only its chosen first six cards', verifications: [
    { spec: 'Each hand contains exactly six playable first-half cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(6); } },
    { spec: 'Alex’s six exact choices remain and the held half is absent', check: async () => { const hand = page.getByRole('region', { name: 'Your hand' }); for (const label of alexFirst) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible(); } },
    { spec: 'The ordinary first trick can begin', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  for (let play = 0; play < 18; play += 1) await clickCurrentCard(game.players);
  await steps.step('after-party-second-half', { description: 'After six complete tricks exhaust the first hands, all three held six-card halves appear automatically', verifications: [
    { spec: 'Every player picks up exactly six second-half cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(6); } },
    { spec: 'None of Alex’s first-hand cards returns', check: async () => { const hand = page.getByRole('region', { name: 'Your hand' }); for (const label of alexFirst) await expect(hand.getByRole('button', { name: label, exact: true })).toHaveCount(0); } },
    { spec: 'Trick seven is announced', check: async () => expect(page.getByRole('alert')).toContainText('Trick 7') }
  ] });
  for (let play = 18; play < 36; play += 1) await clickCurrentCard(game.players);
  await steps.step('after-party-complete', { description: 'Six more ordinary tricks consume the second halves and reveal normal round scoring', verifications: [
    { spec: 'All three hands are empty', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'Round one scoring is visible', check: async () => expect(page.getByRole('region', { name: 'Round 1 scoring' })).toBeVisible() }
  ] });
  expect(joFirst).toHaveLength(6); expect(samFirst).toHaveLength(6);
  steps.generateDocs(); await closeRoundCardGame(game);
});
