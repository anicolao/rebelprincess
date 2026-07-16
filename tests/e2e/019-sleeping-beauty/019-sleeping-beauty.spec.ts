import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CSB0000D', desktop: 'CSB0000H' } as const;

test('Sleeping Beauty redistributes cards entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Sleeping Beauty click activation', 'Click Sleeping Beauty, collection, every contribution, their order, and redistribution.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Sleeping Beauty', 'interactive');
  const princess = page.getByRole('button', { name: 'Use Sleeping Beauty power' }); await expect(princess).toBeEnabled(); await princess.click();
  await steps.step('sleeping-beauty-collection-prompt', { description: 'Clicking Sleeping Beauty exposes collection confirmation', verifications: [
    { spec: 'The Begin collection button is enabled', check: async () => expect(page.getByRole('button', { name: 'Begin collection' })).toBeEnabled() },
    { spec: 'Her Princess card reports pressed', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') }
  ] });
  await page.getByRole('group', { name: 'Sleeping Beauty power' }).getByRole('button', { name: 'Begin collection' }).click();
  await steps.step('sleeping-beauty-contribution-prompt', { description: 'Beginning collection highlights a contribution in every hand', verifications: [
    { spec: 'Each client has contributable card records', check: async () => { for (const player of game.players) await expect(player.locator('.playing-card.contributable:not(:disabled)').first()).toBeVisible(); } },
    { spec: 'Observers see the contribution prompt', check: async () => expect(game.jo.getByText('Sleeping Beauty asks you to contribute one card.')).toBeVisible() }
  ] });
  const contributed: string[] = [];
  for (const player of game.players) { const card = player.locator('.playing-card.contributable:not(:disabled)').first(); contributed.push(await card.getAttribute('aria-label') ?? ''); await card.click(); }
  const group = page.getByRole('group', { name: 'Sleeping Beauty redistribution' });
  await steps.step('sleeping-beauty-redistribution-prompt', { description: 'Three clicked contributions appear for ordered redistribution', verifications: [
    { spec: 'The chooser has exactly three contributed card buttons', check: async () => expect(group.getByRole('button').filter({ hasNotText: 'Redistribute' })).toHaveCount(3) },
    { spec: 'Redistribute remains disabled until ordering is complete', check: async () => expect(group.getByRole('button', { name: 'Redistribute' })).toBeDisabled() }
  ] });
  for (const label of contributed) await group.getByRole('button', { name: new RegExp(`${label}$`) }).click();
  await group.getByRole('button', { name: 'Redistribute' }).click();
  await steps.step('sleeping-beauty-clicks-redistribution', { description: 'Every participant and final assignment uses visible clicks', verifications: [
    { spec: 'Sleeping Beauty keeps the first clicked contribution', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[0], exact: true })).toBeVisible() },
    { spec: 'Jo and Sam receive the next clicked cards', check: async () => { await expect(game.jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[1], exact: true })).toBeVisible(); await expect(game.sam.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[2], exact: true })).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
