import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';
import { breaksPrinces, legalCards, trickWinner, type TrickState } from '../../../src/lib/trick-taking';
import type { Card } from '../../../src/lib/setup';

const IDS = { phone: 'REB00000', desktop: 'REB10000' } as const;
const names = ['Alex', 'Jo', 'Sam']; const collector = 'Jo';
const parseCard = (label: string): Card => ({ suit: label.split(' ')[0].toLowerCase() as Card['suit'], rank: Number(label.split(' ')[1]) });
const label = (card: Card) => `${card.suit[0].toUpperCase()}${card.suit.slice(1)} ${card.rank}`;
const target = (card: Card) => card.suit === 'princes' || (card.suit === 'pets' && card.rank === 8);

async function handCards(page: Page): Promise<Card[]> { return (await page.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))).map(parseCard); }

test('Rebel of the Ball awards exactly minus ten after a full cooperative game', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Rebel of the Ball', 'Use only visible hand-card clicks to play all twelve tricks, deliberately collect all nine Princes and the Frog with Jo, and prove the exact −10 override.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Once Upon a Time…', 'REB00000');
  const initial = (await Promise.all(game.players.map(handCards))).flat();
  await steps.step('rebel-ready', { description: 'The complete shared deal visibly contains the nine in-deck Princes and the Frog required for Rebel of the Ball', verifications: [
    { spec: 'Exactly nine Princes are in the three-player deck', check: async () => expect(initial.filter((card) => card.suit === 'princes')).toHaveLength(9) },
    { spec: 'Exactly one Frog is present', check: async () => expect(initial.filter((card) => card.suit === 'pets' && card.rank === 8)).toHaveLength(1) }
  ] });
  let leader = 'Alex'; let broken = false; let collectedTargets = 0; let documentedCapture = false;
  while ((await handCards(page)).length) {
    const hands = Object.fromEntries(await Promise.all(game.players.map(async (player, index) => [names[index], await handCards(player)])));
    const order = Array.from({ length: 3 }, (_, offset) => names[(names.indexOf(leader) + offset) % 3]); let best: { cards: Card[]; winner: string; score: number } | undefined;
    for (const first of legalCards(hands[order[0]], { leaderUid: leader, plays: [] }, broken)) {
      const one: TrickState = { leaderUid: leader, plays: [{ uid: order[0], card: first }] };
      for (const second of legalCards(hands[order[1]], one, broken)) {
        const two: TrickState = { leaderUid: leader, plays: [...one.plays, { uid: order[1], card: second }] };
        for (const third of legalCards(hands[order[2]], two, broken)) {
          const trick: TrickState = { leaderUid: leader, plays: [...two.plays, { uid: order[2], card: third }] }; const winner = trickWinner(trick); const cards = [first, second, third]; const targets = cards.filter(target).length;
          const score = (winner === collector ? 1000 + targets * 100 : -targets * 1000) + cards.filter((card) => !target(card)).length;
          if (!best || score > best.score) best = { cards, winner, score };
        }
      }
    }
    expect(best).toBeTruthy();
    for (let index = 0; index < 3; index += 1) { await game.players[names.indexOf(order[index])].getByRole('button', { name: label(best!.cards[index]), exact: true }).click(); await expect(page.getByLabel(`${order[index]} played ${label(best!.cards[index])}`)).toBeVisible(); }
    if (best!.winner === collector) {
      const wonTargets = best!.cards.filter(target).length; collectedTargets += wonTargets;
      if (wonTargets && !documentedCapture) { await page.getByLabel('Jo tricks').click(); await steps.step('rebel-target-capture', { description: `Jo’s first planned target trick visibly captures ${best!.cards.filter(target).map(label).join(', ')}`, verifications: [
        { spec: 'The open review contains every target from this trick', check: async () => { const review = page.getByLabel('Jo last trick'); for (const card of best!.cards.filter(target)) await expect(review.getByLabel(label(card), { exact: true })).toBeVisible(); } },
        { spec: 'The target count has begun without injecting any events', check: async () => expect(collectedTargets).toBeGreaterThan(0) }
      ] }); documentedCapture = true; }
    }
    for (let index = 0; index < best!.cards.length; index += 1) broken ||= breaksPrinces({ leaderUid: leader, plays: best!.cards.slice(0, index).map((card, playIndex) => ({ uid: order[playIndex], card })) }, best!.cards[index]);
    leader = best!.winner;
  }
  await steps.step('rebel-complete', { description: 'All 36 ordinary UI clicks finish the round with Jo holding every one of the ten required target cards', verifications: [
    { spec: 'The cooperative play captured all nine Princes plus the Frog', check: async () => expect(collectedTargets).toBe(10) },
    { spec: 'Every hand is empty after twelve complete tricks', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(0); } },
    { spec: 'Jo receives the explicit Rebel of the Ball status', check: async () => expect(page.getByText('Rebel of the Ball · −10 proposals', { exact: true })).toBeVisible() },
    { spec: 'Jo’s round equation and cumulative total are exactly −10', check: async () => { const row = page.getByRole('region', { name: 'Round 1 scoring' }).locator('li').filter({ hasText: 'Jo' }); await expect(row.locator('span')).toContainText('= -10'); await expect(row.locator('b')).toContainText('-10 total'); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
