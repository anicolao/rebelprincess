import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CSW00004', desktop: 'CSW00008' } as const;

test('Snow White activates and plays her zero entirely by clicking', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Snow White click activation', 'A player clicks Snow White and then clicks a legal low card; no keyboard or direct backend action is used.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Snow White');
  const princess = page.getByRole('button', { name: 'Use Snow White power' });
  await steps.step('snow-white-ready', { description: 'Snow White is available alongside legal low cards', verifications: [
    { spec: 'The Princess card is enabled', check: async () => expect(princess).toBeEnabled() },
    { spec: 'The hand exposes playable card records', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  await expect(princess).toBeEnabled(); await princess.click(); await expect(princess).toHaveAttribute('aria-pressed', 'true');
  const lowCards = page.locator('.playing-card.playable:not(:disabled)').filter({ has: page.locator('strong') });
  let chosen = lowCards.first();
  for (let index = 0; index < await lowCards.count(); index += 1) if (Number(await lowCards.nth(index).locator('strong').textContent()) <= 7) { chosen = lowCards.nth(index); break; }
  await steps.step('snow-white-armed', { description: 'Clicking Snow White visibly arms the next low card', verifications: [
    { spec: 'The Princess button reports pressed', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') },
    { spec: 'The selected low card button remains enabled', check: async () => expect(chosen).toBeEnabled() }
  ] });
  await chosen.click();
  await steps.step('snow-white-clicks-zero', { description: 'Clicking the Princess arms her and clicking the card applies zero', verifications: [
    { spec: 'The played card visibly counts as zero', check: async () => expect(page.getByLabel('Current trick')).toContainText('Counts as 0') },
    { spec: 'Observers see Snow White exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: Snow White")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
