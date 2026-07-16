import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, setupPrincessGame } from './helpers';

const IDS = { phone: 'CLM0000A', desktop: 'CLM0000B' } as const;

test('The Little Mermaid requests a suit entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Little Mermaid click activation', 'Click the Little Mermaid and click a visible suit choice.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Little Mermaid', 'interactive');
  const princess = page.getByRole('button', { name: 'Use The Little Mermaid power' });
  await expect(princess).toBeEnabled(); await princess.click(); await expect(princess).toHaveAttribute('aria-pressed', 'true');
  const suit = page.getByRole('group', { name: 'Little Mermaid power' }).getByRole('button').filter({ hasNotText: 'princes' }).first();
  const requested = await suit.textContent() ?? ''; await suit.click();
  await expect(page.getByText('Princess power: The Little Mermaid')).toBeVisible();
  const legalSuits = await page.locator('.playing-card.playable:not(:disabled) small').allTextContents();
  await steps.step('little-mermaid-clicks-suit', { description: 'The clicked suit constrains the leader’s visible cards', verifications: [
    { spec: 'Every legal lead matches the clicked suit', check: async () => expect(legalSuits.every((entry) => entry === requested)).toBe(true) },
    { spec: 'Observers see the Mermaid exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: The Little Mermaid")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
