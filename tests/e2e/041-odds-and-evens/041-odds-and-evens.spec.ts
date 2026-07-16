import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'ODD00041', desktop: 'ODD10041' } as const;

test('Odds and Evens visibly narrows legal cards by suit and parity', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Odds and Evens', 'Lead a card, inventory the next hand, prove the exact suit-then-parity enabled set, and complete the trick only through legal clicks.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Odds and Evens');
  await steps.step('parity-ready', { description: 'The center explains that suit takes priority and parity narrows the legal choices whenever possible', verifications: [
    { spec: 'The exact priority rule is readable', check: async () => expect(page.getByText('Follow both suit and the lead card’s parity when possible, with suit taking priority and parity applying again when void.')).toBeVisible() },
    { spec: 'The leader may choose normally', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  const lead = await clickCurrentCard(game.players); const [leadSuit, leadRank] = lead.card.split(' '); const parity = Number(leadRank) % 2;
  await steps.step('parity-led', { description: `${lead.actor} clicks ${lead.card}, establishing ${parity ? 'odd' : 'even'} parity and ${leadSuit} as the primary obligation`, verifications: [
    { spec: 'The exact lead graphic is visible', check: async () => expect(page.getByLabel(`${lead.actor} played ${lead.card}`)).toBeVisible() },
    { spec: 'Exactly one next player has enabled cards', check: async () => expect((await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count()))).filter(Boolean)).toHaveLength(1) }
  ] });
  const counts = await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count())); const followerIndex = counts.findIndex(Boolean); const follower = game.players[followerIndex];
  const all = await follower.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const suited = all.filter((label) => label.startsWith(`${leadSuit} `)); const suitCandidates = suited.length ? suited : all; const parityCandidates = suitCandidates.filter((label) => Number(label.split(' ')[1]) % 2 === parity); const expected = parityCandidates.length ? parityCandidates : suitCandidates;
  const enabled = await follower.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? '').sort());
  await steps.step('parity-filtered', { description: `The follower’s hand is filtered to the exact legal set: ${expected.join(', ')}`, verifications: [
    { spec: 'Enabled cards equal the independently calculated suit-then-parity set', check: async () => expect(enabled).toEqual([...expected].sort()) },
    { spec: 'At least one nonmatching card remains visibly disabled', check: async () => expect(follower.getByRole('region', { name: 'Your hand' }).getByRole('button', { disabled: true }).first()).toBeVisible() }
  ] });
  const follow = await clickCurrentCard(game.players); const last = await clickCurrentCard(game.players);
  await steps.step('parity-complete', { description: `${follow.actor} plays legal ${follow.card}, ${last.actor} follows, and the ordinary winner receives the completed trick`, verifications: [
    { spec: 'All three exact graphics are visible during collection', check: async () => { for (const play of [lead, follow, last]) await expect(page.getByLabel(`${play.actor} played ${play.card}`)).toBeVisible(); } },
    { spec: 'Exactly one trick was awarded', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
