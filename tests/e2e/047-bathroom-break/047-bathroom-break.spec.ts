import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'BAT00047', desktop: 'BAT10047' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Bathroom Break doubles Princes except for the current high-score players', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Bathroom Break', 'Play an unshortened setup round, record cumulative leaders, deal and pass round two through the UI, then reconcile every doubled or exempt Prince.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Once Upon a Time…', IDS[testInfo.project.name as keyof typeof IDS], ['Bathroom Break']);
  await steps.step('bathroom-prior-round', { description: 'Round one begins normally so Bathroom Break will have real prior proposal totals rather than an all-zero tie', verifications: [
    { spec: 'The ordinary first round is visible', check: async () => expect(page.getByRole('heading', { name: 'Once Upon a Time…' })).toBeVisible() },
    { spec: 'Every player starts with twelve cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } }
  ] });
  for (let play = 0; play < 36; play += 1) await clickCurrentCard(game.players);
  const firstRows = page.getByRole('region', { name: 'Round 1 scoring' }).locator('li'); const priorTotals: Record<string, number> = {};
  for (let index = 0; index < names.length; index += 1) priorTotals[names[index]] = Number((await firstRows.nth(index).locator('b').textContent() ?? '').match(/-?\d+/)?.[0] ?? 0);
  const highest = Math.max(...Object.values(priorTotals)); const exempt = names.filter((name) => priorTotals[name] === highest);
  await steps.step('bathroom-leaders-known', { description: `The complete first round establishes ${exempt.join(' and ')} at the current highest total of ${highest}; only they will avoid doubling`, verifications: [
    { spec: 'The recorded totals come from the visible scoring rows', check: async () => { for (const name of names) await expect(firstRows.filter({ hasText: name })).toContainText(`${priorTotals[name]} total`); } },
    { spec: 'The host can deal round two', check: async () => expect(page.getByRole('button', { name: 'Deal round 2' })).toBeEnabled() }
  ] });
  await page.getByRole('button', { name: 'Deal round 2' }).click();
  const hands = game.players.map((player) => player.getByRole('region', { name: 'Your hand' }));
  for (const hand of hands) await expect(hand.getByRole('button')).toHaveCount(12);
  const before = await Promise.all(hands.map((hand) => hand.getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  const outgoing: string[][] = [[], [], []];
  const choose = async (playerIndex: number, count: number) => {
    const startingCount = outgoing[playerIndex].length;
    for (let index = 0; index < count; index += 1) {
      const card = hands[playerIndex].locator('.playing-card:not(.selected)').first();
      outgoing[playerIndex].push(await card.getAttribute('aria-label') ?? '');
      await card.click();
      await expect(hands[playerIndex].locator('.playing-card.selected')).toHaveCount(startingCount + index + 1);
    }
  };
  await steps.step('bathroom-pass-prompt', { description: 'Bathroom Break prints a two-card pass to Jo on Alex’s left before round-two play', verifications: [
    { spec: 'The center icon announces Pass 2 left', check: async () => expect(page.getByLabel('Pass 2 left')).toBeVisible() },
    { spec: 'The disabled action names Jo as the recipient', check: async () => { await expect(page.locator('.pass-submit')).toHaveText('Pass 2 left to Jo'); await expect(page.locator('.pass-submit')).toBeDisabled(); } }
  ] });
  await choose(0, 1);
  await steps.step('bathroom-pass-select-1', { description: `${outgoing[0][0]} is selected as the first of two cards headed left to Jo`, verifications: [
    { spec: 'Exactly one card is raised and the pass remains disabled', check: async () => { await expect(hands[0].locator('.playing-card.selected')).toHaveCount(1); await expect(page.locator('.pass-submit')).toBeDisabled(); } }
  ] });
  await choose(0, 1);
  await steps.step('bathroom-pass-select-2', { description: `${outgoing[0][1]} completes Alex’s explicit two-card choice for Jo`, verifications: [
    { spec: 'Both chosen cards are raised and the pass is enabled', check: async () => { await expect(hands[0].locator('.playing-card.selected')).toHaveCount(2); await expect(page.locator('.pass-submit')).toBeEnabled(); } }
  ] });
  await page.locator('.pass-submit').click();
  await steps.step('bathroom-pass-committed', { description: 'Alex commits both exact cards while Jo and Sam continue deciding', verifications: [
    { spec: 'Both outgoing cards remain visibly committed', check: async () => expect(hands[0].locator('.playing-card.committed')).toHaveCount(2) },
    { spec: 'The table says Alex is waiting for two other players', check: async () => expect(page.getByRole('alert')).toContainText('Waiting for 2 other players') }
  ] });
  await choose(1, 2); await game.jo.locator('.pass-submit').click();
  await steps.step('bathroom-pass-one-waiting', { description: 'Jo commits two cards to Sam; Alex now waits only for Sam’s leftward pass', verifications: [
    { spec: 'Alex’s exact cards remain committed', check: async () => expect(hands[0].locator('.playing-card.committed')).toHaveCount(2) },
    { spec: 'The table reports one remaining player', check: async () => expect(page.getByRole('alert')).toContainText('Waiting for 1 other player') }
  ] });
  await choose(2, 2); await game.sam.locator('.pass-submit').click();
  await steps.step('bathroom-pass-resolved', { description: 'Sam commits last; every two-card leftward transfer resolves simultaneously without losing or duplicating a card', verifications: [
    { spec: 'Every player again holds twelve cards', check: async () => { for (const hand of hands) await expect(hand.getByRole('button')).toHaveCount(12); } },
    { spec: 'Alex retains the ten untouched cards and the resolved hand contains exactly two incoming slots', check: async () => {
      const after = await hands[0].getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
      const retained = before[0].filter((card) => !outgoing[0].includes(card));
      expect(retained.every((card) => after.includes(card))).toBe(true);
      const incoming = after.filter((card) => !retained.includes(card));
      expect(incoming).toHaveLength(2);
    } },
    { spec: 'The simultaneous pass phase has ended', check: async () => expect(page.locator('.pass-submit')).toHaveCount(0) }
  ] });
  await steps.step('bathroom-ready', { description: 'Bathroom Break is dealt as round two after all three clients complete its real pass', verifications: [
    { spec: 'The exact prior-score exception is readable', check: async () => expect(page.getByText('Princes score double, except for the player or players currently carrying the most proposals.')).toBeVisible() },
    { spec: 'Round 2 of 5 is visible', check: async () => expect(page.getByText('Round 2 of 5', { exact: true })).toBeVisible() }
  ] });
  for (let play = 0; play < 36; play += 1) await clickCurrentCard(game.players);
  const secondRows = page.getByRole('region', { name: 'Round 2 scoring' }).locator('li');
  await steps.step('bathroom-scored', { description: 'The complete second-round breakdown doubles each nonleader’s Princes and leaves every prior high-score player exempt', verifications: [
    { spec: 'Each scoring row matches its prior-total exemption', check: async () => { for (let index = 0; index < names.length; index += 1) { const text = await secondRows.nth(index).locator('span').textContent() ?? ''; const princes = Number(text.match(/^(\d+) Princes/)?.[1] ?? 0); const modifier = Number(text.match(/\+ (\d+) Round rule/)?.[1] ?? 0); expect(modifier, `${names[index]} Bathroom modifier`).toBe(exempt.includes(names[index]) ? 0 : princes); } } },
    { spec: 'All hands are empty after both unshortened rounds', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
