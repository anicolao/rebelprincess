import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CPE00001', desktop: 'CPE00002' } as const;

test('The Pea Princess restricts play entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Pea Princess click activation', 'Click the Pea Princess, then click through the constrained trick.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Pea Princess');
  const princess = page.getByRole('button', { name: 'Use The Pea Princess power' });
  await steps.step('pea-princess-ready', { description: 'The Pea Princess is ready before any card is played', verifications: [
    { spec: 'Her Princess card is enabled', check: async () => expect(princess).toBeEnabled() },
    { spec: 'The full legal lead set is initially visible', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  await expect(princess).toBeEnabled(); await princess.click();
  await expect(page.getByText('Princess power: The Pea Princess')).toBeVisible();
  const ranks = await page.locator('.playing-card.playable:not(:disabled) strong').allTextContents();
  expect(ranks.length).toBeGreaterThan(0); expect(ranks.every((rank) => Number(rank) > 5)).toBe(true);
  await steps.step('pea-princess-clicked', { description: 'Clicking her visibly restricts the legal card records', verifications: [
    { spec: 'The active power is visible', check: async () => expect(page.getByText('Princess power: The Pea Princess')).toBeVisible() },
    { spec: 'Every legal card rank is above five', check: async () => expect(ranks.every((rank) => Number(rank) > 5)).toBe(true) }
  ] });
  const first = await playOneClick(game.players);
  await steps.step('pea-princess-first-high-card', { description: `Alex clicks the constrained ${first}; its rank above five is visible in the trick`, verifications: [
    { spec: 'Every initially legal card is above five', check: async () => expect(ranks.every((rank) => Number(rank) > 5)).toBe(true) },
    { spec: 'Alex’s clicked high card is visible to every player', check: async () => { expect(Number(first.split(' ')[1])).toBeGreaterThan(5); for (const player of game.players) await expect(player.getByLabel(`Alex played ${first}`)).toBeVisible(); } }
  ] });
  const second = await playOneClick(game.players);
  const fallbackRanks = await game.sam.locator('.playing-card.playable:not(:disabled) strong').allTextContents();
  const usesFallback = fallbackRanks.every((rank) => Number(rank) <= 5);
  await steps.step('pea-princess-final-player-options', { description: usesFallback ? 'Sam has no above-five card in the led suit, so the legal low-card fallback is shown before it is clicked' : 'Sam has an above-five card in the led suit, so only high cards remain clickable', verifications: [
    { spec: 'Sam has at least one legal follow-suit card', check: async () => expect(fallbackRanks.length).toBeGreaterThan(0) },
    { spec: usesFallback ? 'Every available fallback is five or lower' : 'Every available card is above five', check: async () => expect(fallbackRanks.every((rank) => usesFallback ? Number(rank) <= 5 : Number(rank) > 5)).toBe(true) }
  ] });
  const third = await playOneClick(game.players);
  const names = ['Alex', 'Jo', 'Sam'];
  await expect.poll(async () => Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).toContain(1);
  const winnerName = names[(await Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).findIndex((count) => count === 1)];
  await page.getByLabel(`${winnerName} tricks`).click();
  await steps.step('pea-princess-constrained-trick-awarded', { description: `${winnerName}’s awarded trick shows ${first}, ${second}, and Sam’s ${usesFallback ? 'legal low-card fallback' : 'required high card'}, ${third}`, verifications: [
    { spec: 'The open review contains all three clicked cards', check: async () => expect(page.getByLabel(`${winnerName} last trick`).locator('.review-card')).toHaveCount(3) },
    { spec: 'Observers see the active exhausted Princess', check: async () => expect(game.jo.getByLabel("Alex's Princess: The Pea Princess")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
