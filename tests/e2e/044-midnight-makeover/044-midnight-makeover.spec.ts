import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'MID00044', desktop: 'MID10044' } as const;
const names = ['Alex', 'Jo', 'Sam'];

test('Midnight Makeover lets a Fairy act as a wild leading-suit card', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Midnight Makeover', 'Choose a lead whose follower holds both that suit and a Fairy, click the Fairy instead, and prove it competes as a leading-suit card.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Midnight Makeover');
  await steps.step('makeover-ready', { description: 'The center announces that Fairies may follow as wild cards and equal values favor the latest play', verifications: [
    { spec: 'The exact wild-card rule is readable', check: async () => expect(page.getByText('Fairies are wild for following suit. Highest leading-suit card or Fairy wins, with latest play breaking ties.')).toBeVisible() },
    { spec: 'A leader is ready to choose a non-Fairy suit', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  const activeCounts = await Promise.all(game.players.map((player) => player.locator('.playing-card.playable:not(:disabled)').count())); const leaderIndex = activeCounts.findIndex(Boolean); const followerIndex = (leaderIndex + 1) % 3;
  const leaderLabels = await game.players[leaderIndex].locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const followerLabels = await game.players[followerIndex].getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const leadLabel = leaderLabels.find((label) => !label.startsWith('Fairies ') && followerLabels.some((other) => other.startsWith(`${label.split(' ')[0]} `)) && followerLabels.some((other) => other.startsWith('Fairies ')));
  expect(leadLabel, 'the narrative seed must offer a normal suit beside a Fairy').toBeTruthy(); const ledSuit = leadLabel!.split(' ')[0];
  await game.players[leaderIndex].getByRole('button', { name: leadLabel!, exact: true }).click(); await expect(page.getByLabel(`${names[leaderIndex]} played ${leadLabel}`)).toBeVisible();
  await steps.step('makeover-led', { description: `${names[leaderIndex]} leads ${leadLabel}; ${names[followerIndex]} visibly holds both ${ledSuit} and a Fairy`, verifications: [
    { spec: 'The exact non-Fairy lead is visible', check: async () => expect(page.getByLabel(`${names[leaderIndex]} played ${leadLabel}`)).toBeVisible() },
    { spec: 'Both an ordinary follower and a Fairy are enabled', check: async () => { const enabled = game.players[followerIndex].locator('.playing-card.playable:not(:disabled)'); await expect(enabled.filter({ hasText: ledSuit.toLowerCase() }).first()).toBeVisible(); await expect(enabled.filter({ hasText: 'fairies' }).first()).toBeVisible(); } }
  ] });
  const fairy = game.players[followerIndex].locator('.playing-card.playable:not(:disabled)').filter({ hasText: 'fairies' }).first(); const fairyLabel = await fairy.getAttribute('aria-label') ?? ''; await fairy.click(); await expect(page.getByLabel(`${names[followerIndex]} played ${fairyLabel}`)).toBeVisible();
  await steps.step('makeover-fairy', { description: `${names[followerIndex]} clicks ${fairyLabel} despite holding ${ledSuit}; the Fairy graphic is accepted as a wild follower`, verifications: [
    { spec: 'The Fairy is visible beside the normal lead', check: async () => expect(page.getByLabel(`${names[followerIndex]} played ${fairyLabel}`)).toBeVisible() },
    { spec: 'The final player receives the normal next turn', check: async () => expect(game.players[(followerIndex + 1) % 3].getByRole('alert')).toContainText('Your turn') }
  ] });
  const last = await clickCurrentCard(game.players); const plays = [{ actor: names[leaderIndex], card: leadLabel! }, { actor: names[followerIndex], card: fairyLabel }, last];
  const eligible = plays.filter((play) => play.card.startsWith(`${ledSuit} `) || play.card.startsWith('Fairies ')); const winner = eligible.reduce((best, play) => Number(play.card.split(' ')[1]) >= Number(best.card.split(' ')[1]) ? play : best);
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1'); await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('makeover-awarded', { description: `${winner.card} is highest among the ${ledSuit} cards and wild Fairy, so ${winner.actor} receives the trick`, verifications: [
    { spec: 'The review contains the wild Fairy', check: async () => expect(page.getByLabel(`${winner.actor} last trick`).getByLabel(fairyLabel, { exact: true })).toBeVisible() },
    { spec: `The trick counter awards ${winner.actor}`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
