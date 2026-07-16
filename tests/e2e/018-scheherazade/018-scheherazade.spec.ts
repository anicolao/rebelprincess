import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CSC0000B', desktop: 'CSC0000F' } as const;

test('Scheherazade swaps cards entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Scheherazade click activation', 'Click Scheherazade, Jo, and the card to exchange.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Scheherazade', 'interactive');
  const princess = page.getByRole('button', { name: 'Use Scheherazade power' }); await expect(princess).toBeEnabled(); await princess.click();
  await steps.step('scheherazade-target-prompt', { description: 'Clicking Scheherazade opens the other-hand chooser', verifications: [
    { spec: 'Only the two opponents are target buttons', check: async () => expect(page.getByRole('group', { name: 'Scheherazade power' }).getByRole('button')).toHaveCount(2) },
    { spec: 'Her Princess button reports pressed', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') }
  ] });
  await page.getByRole('group', { name: 'Scheherazade power' }).getByRole('button', { name: 'Jo' }).click();
  const group = page.getByRole('group', { name: 'Scheherazade swap' });
  const taken = (await group.locator('strong').textContent())?.replace('Took ', '') ?? '';
  await steps.step('scheherazade-swap-prompt', { description: 'Clicking Jo reveals the taken card and exchange choices', verifications: [
    { spec: 'The taken card is named in the chooser data', check: async () => expect(group.locator('strong')).toContainText('Took ') },
    { spec: 'At least one Swap button is enabled', check: async () => expect(group.getByRole('button', { name: /^Swap / }).first()).toBeEnabled() }
  ] });
  const swap = group.getByRole('button', { name: /^Swap / }).first(); const given = (await swap.textContent())?.replace('Swap ', '') ?? ''; await swap.click();
  await steps.step('scheherazade-clicks-exchange', { description: 'The three UI clicks exchange the displayed cards', verifications: [
    { spec: 'The inspected card appears in Scheherazade’s hand', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: taken, exact: true })).toBeVisible() },
    { spec: 'The clicked exchange card leaves her hand', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: given, exact: true })).toHaveCount(0) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
