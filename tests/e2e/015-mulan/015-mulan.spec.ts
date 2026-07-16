import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CMU00003', desktop: 'CMU0000S' } as const;

test('Mulan swaps her played card entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Mulan click activation', 'Click all three trick cards, click Mulan, then click a replacement.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Mulan');
  const cards = page.locator('.playing-card.playable:not(:disabled)');
  const labels = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
  const lead = labels.find((label) => label !== 'Pets 8' && labels.filter((other) => other.split(' ')[0] === label.split(' ')[0]).length > 1);
  if (!lead) throw new Error('Mulan needs a same-suit replacement');
  await page.getByRole('button', { name: lead, exact: true }).click();
  for (const player of game.players) await expect(player.getByLabel(`Alex played ${lead}`)).toBeVisible();
  await playOneClick(game.players); await playOneClick(game.players);
  await expect(page.getByRole('alert')).toHaveText('Tap Mulan to swap her played card or keep it');
  await steps.step('mulan-decision-prompt', { description: 'The completed trick pauses and prompts Mulan', verifications: [
    { spec: 'Mulan’s button becomes enabled only at the decision', check: async () => expect(page.getByRole('button', { name: 'Use Mulan power' })).toBeEnabled() },
    { spec: 'Observers name Alex as the pending resolver', check: async () => expect(game.jo.getByRole('alert')).toHaveText('Waiting for Alex to resolve Mulan') }
  ] });
  const princess = page.getByRole('button', { name: 'Use Mulan power' });
  await expect(princess).toBeEnabled(); await princess.click(); await expect(princess).toHaveAttribute('aria-pressed', 'true');
  await steps.step('mulan-swap-prompt', { description: 'Clicking Mulan reveals same-suit replacements', verifications: [
    { spec: 'The Princess button reports pressed', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') },
    { spec: 'At least one replacement button is enabled', check: async () => expect(page.getByRole('group', { name: 'Mulan power' }).getByRole('button', { name: /^Swap for / }).first()).toBeEnabled() }
  ] });
  const replacement = page.getByRole('group', { name: 'Mulan power' }).getByRole('button', { name: /^Swap for / }).first();
  const replacementLabel = (await replacement.textContent())?.replace('Swap for ', '') ?? ''; await replacement.click();
  await steps.step('mulan-clicks-swap', { description: 'Clicking Mulan and a replacement visibly changes the full trick', verifications: [
    { spec: 'The replacement graphic is in the resolved trick', check: async () => expect(page.getByLabel(`Alex played ${replacementLabel}`)).toBeVisible() },
    { spec: 'The original card returns to Mulan’s hand', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: lead, exact: true })).toBeVisible() }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
