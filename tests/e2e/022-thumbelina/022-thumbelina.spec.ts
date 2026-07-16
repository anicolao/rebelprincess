import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'TP300000', desktop: 'TD300000' } as const;

test('Thumbelina ignores the led suit entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Thumbelina click activation', 'Play normally until Thumbelina is following, click her card, then click a non-Prince, non-Frog card outside the led suit.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Thumbelina');
  const princess = page.getByRole('button', { name: 'Use Thumbelina power' });
  for (let plays = 0; plays < 36 && !await princess.isEnabled(); plays += 1) await playOneClick(game.players);
  await expect(princess).toBeEnabled();
  const ledSuit = (await page.getByLabel('Current trick').locator('.trick-play').first().getAttribute('aria-label') ?? '').split(' played ')[1]?.split(' ')[0] ?? '';
  const ordinary = await page.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  await steps.step('thumbelina-following', { description: `Thumbelina is following ${ledSuit}; ordinary play exposes only that led suit`, verifications: [
    { spec: 'At least one card has already established the led suit', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play').first()).toBeVisible() },
    { spec: 'Every ordinarily playable card follows the led suit', check: async () => { expect(ordinary.length).toBeGreaterThan(0); expect(ordinary.every((label) => label.startsWith(`${ledSuit} `))).toBe(true); } },
    { spec: 'Thumbelina’s card is enabled only while she is following', check: async () => expect(princess).toBeEnabled() }
  ] });
  await princess.click();
  const labels = await page.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const alternativeLabel = labels.find((label) => !label.startsWith(`${ledSuit} `) && !label.startsWith('Princes ') && label !== 'Pets 8');
  if (!alternativeLabel) throw new Error('Thumbelina’s deterministic hand needs a legal off-suit alternative');
  await steps.step('thumbelina-ignores-suit', { description: `Clicking Thumbelina exposes ${alternativeLabel} outside the led ${ledSuit} suit`, verifications: [
    { spec: 'Thumbelina reports her armed state', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') },
    { spec: 'The off-suit alternative is clickable', check: async () => expect(page.getByRole('button', { name: alternativeLabel, exact: true })).toBeEnabled() },
    { spec: 'Princes and the Frog remain unavailable through her power', check: async () => expect(labels.some((label) => label.startsWith('Princes ') || label === 'Pets 8')).toBe(false) }
  ] });
  await page.getByRole('button', { name: alternativeLabel, exact: true }).click();
  await steps.step('thumbelina-off-suit-played', { description: `Thumbelina clicks ${alternativeLabel}; the off-suit card appears beside the ${ledSuit} lead`, verifications: [
    { spec: 'The actual off-suit graphic appears in the center', check: async () => expect(page.getByLabel(`Alex played ${alternativeLabel}`)).toBeVisible() },
    { spec: 'The played card is neither a Prince nor the Frog', check: async () => { expect(alternativeLabel.startsWith('Princes ')).toBe(false); expect(alternativeLabel).not.toBe('Pets 8'); } },
    { spec: 'Every player sees Thumbelina exhausted', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(game.sam.getByLabel("Alex's Princess: Thumbelina")).toHaveClass(/exhausted/); } }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
