import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CPO00005', desktop: 'CPO00006' } as const;

test('Pocahontas transfers the lead entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Pocahontas click activation', 'Click Pocahontas, then click Jo in the visible lead chooser.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Pocahontas');
  const princess = page.getByRole('button', { name: 'Use Pocahontas power' });
  await expect(princess).toBeEnabled(); await princess.click(); await expect(princess).toHaveAttribute('aria-pressed', 'true');
  await steps.step('pocahontas-leader-prompt', { description: 'Clicking Pocahontas opens a leader button for every player', verifications: [
    { spec: 'Pocahontas reports pressed', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') },
    { spec: 'The chooser contains three leader records', check: async () => expect(page.getByRole('group', { name: 'Pocahontas power' }).getByRole('button')).toHaveCount(3) }
  ] });
  const transfer = page.getByRole('group', { name: 'Pocahontas power' }).getByRole('button', { name: 'Jo leads' });
  await expect(transfer).toBeEnabled(); await transfer.click();
  await steps.step('pocahontas-clicks-new-leader', { description: 'The chooser click changes the shared leader immediately', verifications: [
    { spec: 'Jo receives the prominent local lead indicator', check: async () => expect(game.jo.getByText('You lead', { exact: true })).toBeVisible() },
    { spec: 'Pocahontas is exhausted for every client', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(game.sam.getByLabel("Alex's Princess: Pocahontas")).toHaveClass(/exhausted/); } }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
