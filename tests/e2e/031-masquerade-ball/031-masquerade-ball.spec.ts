import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'MBA00031', desktop: 'MBA10031' } as const;

test('Masquerade Ball conceals followers until the complete trick reveals them', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Masquerade Ball', 'Watch the lead face up, both followers commit hidden cards through clicks, then review every revealed card in the awarded trick.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Masquerade Ball', undefined, [], { steps, direction: 'left', count: 1 });
  await steps.step('masquerade-ready', { description: 'The round card announces that only the lead stays face up while followers commit', verifications: [
    { spec: 'The conceal-and-reveal rule is readable', check: async () => expect(page.getByText('Except for the lead, play cards face down. Reveal them together to determine the trick winner.')).toBeVisible() },
    { spec: 'A leader is visibly ready to click', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  const lead = await clickCurrentCard(game.players);
  await steps.step('masquerade-lead', { description: `${lead.actor} leads ${lead.card} face up so everyone knows which suit to follow`, verifications: [
    { spec: 'The exact lead graphic is public', check: async () => expect(page.getByLabel(`${lead.actor} played ${lead.card}`)).toBeVisible() },
    { spec: 'Only one card is currently committed', check: async () => expect(page.getByLabel('Current trick').locator('.trick-play')).toHaveCount(1) }
  ] });
  const counts = await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count()));
  const hiddenIndex = counts.findIndex((count) => count > 0);
  const hiddenCard = game.players[hiddenIndex].locator('.playing-card.playable:not(:disabled)').first();
  const hidden = { actor: ['Alex', 'Jo', 'Sam'][hiddenIndex], card: await hiddenCard.getAttribute('aria-label') ?? '' };
  await hiddenCard.click(); await expect(page.getByLabel(`${hidden.actor} played a face-down card`)).toBeVisible();
  await steps.step('masquerade-hidden', { description: `${hidden.actor} clicks a legal card, but opponents see a face-down card rather than ${hidden.card}`, verifications: [
    { spec: 'The follower is explicitly announced as face down', check: async () => expect(page.getByLabel(`${hidden.actor} played a face-down card`)).toBeVisible() },
    { spec: 'The private card label is not exposed in the center yet', check: async () => expect(page.getByLabel(`${hidden.actor} played ${hidden.card}`)).toHaveCount(0) }
  ] });
  const last = await clickCurrentCard(game.players);
  await expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1);
  await steps.step('masquerade-revealed', { description: `${last.actor} commits the final hidden card; all three actual graphics reveal together before collection`, verifications: [
    { spec: `${hidden.actor}’s concealed ${hidden.card} is now visible`, check: async () => expect(page.getByLabel(`${hidden.actor} played ${hidden.card}`)).toBeVisible() },
    { spec: `${last.actor}’s final ${last.card} is now visible`, check: async () => expect(page.getByLabel(`${last.actor} played ${last.card}`)).toBeVisible() }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
