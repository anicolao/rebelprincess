import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'RMB00001', desktop: 'RMB00002' } as const;

test('Magic Beans permits only suit extremes entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Magic Beans', 'Reveal the rule, compare enabled extremes with a disabled middle card, then click a complete constrained trick and review it.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Magic Beans', undefined, [], { steps, direction: 'left', count: 3 });
  const hand = page.getByRole('region', { name: 'Your hand' });
  const labels = await hand.getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const grouped = Object.groupBy(labels, (label) => label.split(' ')[0]);
  const [suit, suitCards = []] = Object.entries(grouped).find(([name, cards]) => name !== 'Princes' && (cards?.length ?? 0) >= 3) ?? [];
  if (!suit || suitCards.length < 3) throw new Error('Magic Beans needs three lead cards in one non-Prince suit');
  const sorted = [...suitCards].sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
  await steps.step('bean-extremes-ready', { description: `For ${suit}, only ${sorted[0]} and ${sorted.at(-1)} are enabled; middle card ${sorted[1]} is disabled`, verifications: [
    { spec: 'The center prints the highest-or-lowest restriction', check: async () => expect(page.getByText('Play only the highest or lowest card of the suit you must play.')).toBeVisible() },
    { spec: 'The suit’s lowest and highest cards are enabled', check: async () => { await expect(hand.getByRole('button', { name: sorted[0], exact: true })).toBeEnabled(); await expect(hand.getByRole('button', { name: sorted.at(-1)!, exact: true })).toBeEnabled(); } },
    { spec: 'A middle card of the same suit is disabled', check: async () => expect(hand.getByRole('button', { name: sorted[1], exact: true })).toBeDisabled() }
  ] });
  const plays = [await clickCurrentCard(game.players)];
  const joLegal = await game.jo.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  await steps.step('bean-follower-extremes', { description: `${plays[0].actor} clicks ${plays[0].card}; Jo is offered only the extreme legal followers`, verifications: [
    { spec: 'The exact lead graphic is visible', check: async () => expect(page.getByLabel(`${plays[0].actor} played ${plays[0].card}`)).toBeVisible() },
    { spec: 'Jo has no more than two enabled cards in the led suit', check: async () => { expect(joLegal.length).toBeGreaterThan(0); expect(joLegal.length).toBeLessThanOrEqual(2); } }
  ] });
  plays.push(await clickCurrentCard(game.players));
  await steps.step('bean-second-play', { description: `${plays[1].actor} clicks the constrained ${plays[1].card}`, verifications: [
    { spec: 'Two exact card graphics are visible in play order', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(2) },
    { spec: 'Sam receives the final turn', check: async () => expect(game.sam.getByRole('alert')).toContainText('Your turn') }
  ] });
  plays.push(await clickCurrentCard(game.players));
  const names = ['Alex', 'Jo', 'Sam']; await expect.poll(async () => Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).toContain(1);
  const winner = names[(await Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())))).findIndex((count) => count === 1)]; await page.getByLabel(`${winner} tricks`).click();
  await steps.step('bean-trick-awarded', { description: `${winner}’s review shows all three clicked extreme-card plays`, verifications: [
    { spec: 'The awarded review contains three card graphics', check: async () => expect(page.getByLabel(`${winner} last trick`).locator('.review-card')).toHaveCount(3) },
    { spec: 'Magic Beans remains the visible active Round card', check: async () => expect(page.getByRole('heading', { name: 'Magic Beans' })).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
