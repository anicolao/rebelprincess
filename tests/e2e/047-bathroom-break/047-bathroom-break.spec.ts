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
  for (const player of game.players) { const hand = player.getByRole('region', { name: 'Your hand' }); await expect(hand.getByRole('button')).toHaveCount(12); await hand.getByRole('button').first().click(); await player.locator('.pass-submit').click(); }
  for (const player of game.players) await expect(player.locator('.pass-submit')).toHaveCount(0);
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
