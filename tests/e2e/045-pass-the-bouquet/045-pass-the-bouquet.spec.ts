import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'BOU00045', desktop: 'BOU10045' } as const;

test('Pass the Bouquet changes the required and winning suit mid-trick', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Pass the Bouquet', 'Lead Pets to a void player, introduce a new suit through a click, prove the last player must follow that new suit, and award its highest card.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Pass the Bouquet', 'PR000067');
  await steps.step('bouquet-ready', { description: 'The center announces that each newly introduced suit takes the bouquet and becomes the winning suit', verifications: [
    { spec: 'The exact moving-suit rule is readable', check: async () => expect(page.getByText('Every newly played suit becomes the leading suit. The highest card of the last new suit wins.')).toBeVisible() },
    { spec: 'Alex can lead deterministic Pets 7', check: async () => expect(page.getByRole('button', { name: 'Pets 7', exact: true })).toBeEnabled() }
  ] });
  await page.getByRole('button', { name: 'Pets 7', exact: true }).click(); await expect(page.getByLabel('Alex played Pets 7')).toBeVisible();
  await steps.step('bouquet-pets-led', { description: 'Alex clicks Pets 7, but Jo is void and therefore may introduce a new suit', verifications: [
    { spec: 'The Pet lead is visible', check: async () => expect(page.getByLabel('Alex played Pets 7')).toBeVisible() },
    { spec: 'Jo has no enabled Pet card', check: async () => expect(game.jo.locator('.playing-card.playable:not(:disabled)').filter({ hasText: 'pets' })).toHaveCount(0) }
  ] });
  const joLabels = await game.jo.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const samLabels = await game.sam.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const joCard = joLabels.find((label) => samLabels.some((other) => other.startsWith(`${label.split(' ')[0]} `)))!; const newSuit = joCard.split(' ')[0]; await game.jo.getByRole('button', { name: joCard, exact: true }).click();
  await steps.step('bouquet-new-suit', { description: `Jo clicks ${joCard}; ${newSuit} takes the bouquet and immediately replaces Pets as Sam’s required suit`, verifications: [
    { spec: 'Jo’s exact new-suit graphic is visible', check: async () => expect(page.getByLabel(`Jo played ${joCard}`)).toBeVisible() },
    { spec: `Every enabled Sam card is ${newSuit}`, check: async () => { const labels = await game.sam.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? '')); expect(labels.length).toBeGreaterThan(0); expect(labels.every((label) => label.startsWith(`${newSuit} `))).toBe(true); } }
  ] });
  const sam = await clickCurrentCard(game.players); const candidates = [{ actor: 'Jo', card: joCard }, sam]; const winner = candidates.reduce((best, play) => Number(play.card.split(' ')[1]) > Number(best.card.split(' ')[1]) ? play : best);
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1'); await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('bouquet-awarded', { description: `${winner.card} is the highest ${newSuit} card and wins; Alex’s original Pet no longer controls the trick`, verifications: [
    { spec: `The trick counter awards ${winner.actor}`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') },
    { spec: 'The review contains the old Pet lead and both new-suit cards', check: async () => { const review = page.getByLabel(`${winner.actor} last trick`); for (const label of ['Pets 7', joCard, sam.card]) await expect(review.getByLabel(label, { exact: true })).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
