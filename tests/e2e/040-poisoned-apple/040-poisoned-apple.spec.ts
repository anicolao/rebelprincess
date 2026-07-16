import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'POI00040', desktop: 'POI10040' } as const;

test('Poisoned Apple visibly awards the highest off-suit card', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Poisoned Apple', 'Lead a suit a follower cannot match, click the strongest off-suit response, finish the trick, and review the poisoned winner.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Poisoned Apple', 'PR000067');
  await steps.step('poison-ready', { description: 'The center announces that failing to follow suit changes who wins, with earliest play resolving equal void values', verifications: [
    { spec: 'The exact void-card rule is readable', check: async () => expect(page.getByText('A player who is void wins with the card they play. Highest value wins among multiple void players; the first tied card wins.')).toBeVisible() },
    { spec: 'Alex can lead the deterministic Pets 7', check: async () => expect(page.getByRole('button', { name: 'Pets 7', exact: true })).toBeEnabled() }
  ] });
  await page.getByRole('button', { name: 'Pets 7', exact: true }).click(); await expect(page.getByLabel('Alex played Pets 7')).toBeVisible();
  await steps.step('poison-pet-led', { description: 'Alex clicks Pets 7; Jo is visibly void in Pets and may choose from another suit', verifications: [
    { spec: 'The exact Pet lead is visible', check: async () => expect(page.getByLabel('Alex played Pets 7')).toBeVisible() },
    { spec: 'Jo receives a turn with no enabled Pet', check: async () => { await expect(game.jo.getByRole('alert')).toContainText('Your turn'); await expect(game.jo.locator('.playing-card.playable:not(:disabled)').filter({ hasText: 'pets' })).toHaveCount(0); } }
  ] });
  const joCards = game.jo.locator('.playing-card.playable:not(:disabled)'); const labels = await joCards.evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const joCard = [...labels].sort((left, right) => Number(right.split(' ')[1]) - Number(left.split(' ')[1]))[0]; await game.jo.getByRole('button', { name: joCard, exact: true }).click(); await expect(page.getByLabel(`Jo played ${joCard}`)).toBeVisible();
  await steps.step('poison-void-played', { description: `Jo clicks off-suit ${joCard}; the actual graphic shows the Poisoned Apple condition in action`, verifications: [
    { spec: 'Jo’s off-suit card is visible beside Pets 7', check: async () => expect(page.getByLabel(`Jo played ${joCard}`)).toBeVisible() },
    { spec: 'Sam receives the final normal UI turn', check: async () => expect(game.sam.getByRole('alert')).toContainText('Your turn') }
  ] });
  const sam = await clickCurrentCard(game.players); const plays = [{ actor: 'Alex', card: 'Pets 7' }, { actor: 'Jo', card: joCard }, sam];
  const voids = plays.filter((play) => !play.card.startsWith('Pets ')); const winner = voids.reduce((best, play) => Number(play.card.split(' ')[1]) > Number(best.card.split(' ')[1]) ? play : best);
  await expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1'); await page.getByLabel(`${winner.actor} tricks`).click();
  await steps.step('poison-awarded', { description: `${winner.actor}’s ${winner.card} is the highest off-suit card and captures the trick despite the Pet lead`, verifications: [
    { spec: `The trick counter awards ${winner.actor}`, check: async () => expect(page.getByLabel(`${winner.actor} tricks`)).toHaveText('1') },
    { spec: 'The open review contains all three exact cards', check: async () => { const review = page.getByLabel(`${winner.actor} last trick`); for (const play of plays) await expect(review.getByLabel(play.card, { exact: true })).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
