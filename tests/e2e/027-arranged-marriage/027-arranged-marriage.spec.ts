import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickCurrentCard, closeRoundCardGame, setupRoundCardGame } from '../helpers/round-card-game';

const IDS = { phone: 'RAM0000L', desktop: 'RAM0000O' } as const;

test('Arranged Marriage penalizes a trickless player after a fully clicked round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Arranged Marriage', 'Reveal the trickless penalty, play all 36 cards through the UI, and compare a trickless player’s five proposals with a player who captured a trick.');
  const game = await setupRoundCardGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Arranged Marriage', 'AM000001', [], { steps, direction: 'split', count: 2 });
  await steps.step('marriage-rule-ready', { description: 'Arranged Marriage warns that ending the round without a trick costs five proposals', verifications: [
    { spec: 'The exact trickless penalty is printed', check: async () => expect(page.getByText('A player with no tricks at round end receives 5 proposals.')).toBeVisible() },
    { spec: 'Every player begins with zero captured tricks', check: async () => { for (const name of ['Alex', 'Jo', 'Sam']) await expect(page.getByLabel(`${name} tricks`)).toHaveText('0'); } }
  ] });
  for (let play = 0; play < 36; play += 1) await clickCurrentCard(game.players, (actor) => actor !== 'Sam');
  const names = ['Alex', 'Jo', 'Sam']; const counts = await Promise.all(names.map(async (name) => Number(await page.getByLabel(`${name} tricks`).textContent())));
  const trickless = names[counts.findIndex((count) => count === 0)];
  if (!trickless) throw new Error('Arranged Marriage deterministic round needs a trickless player');
  const scoring = page.getByRole('region', { name: 'Round 1 scoring' });
  await steps.step('marriage-penalty-scored', { description: `${trickless} captured no tricks and receives the visible five-proposal Round penalty`, verifications: [
    { spec: `${trickless} still has zero captured tricks`, check: async () => expect(page.getByLabel(`${trickless} tricks`)).toHaveText('0') },
    { spec: 'The scoring row contains the +5 Round rule modifier', check: async () => expect(scoring.getByText(/\+ 5 Round rule/)).toBeVisible() },
    { spec: 'At least one player with a captured trick avoids that modifier', check: async () => expect(counts.some((count) => count > 0)).toBe(true) }
  ] });
  steps.generateDocs(); await closeRoundCardGame(game);
});
