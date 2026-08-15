import { expect, test, type Page } from '@playwright/test';
import { closePrincessGame, declineRemainingBeforeTrickPlayers, playOneClick, setupPrincessGame, type PrincessGame } from '../helpers/princess-click-game';
import { clickAndConfirm } from '../helpers/round-card-game';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = { phone: 'SB000047', desktop: 'SB000059' } as const;
const ROUND_IDS = 'odds-and-evens,bathroom-break,once-upon-a-time,late-for-a-very-important-date,prince-rings-twice';

async function contributeOneCard(players: Page[], excluded: Set<string> = new Set()): Promise<string[]> {
  const contributed: string[] = [];
  for (const player of players) {
    const choices = player.locator('.playing-card.contributable:not(:disabled)');
    const labels = await choices.evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
    const label = labels.find((candidate) => candidate && !excluded.has(candidate));
    if (!label) throw new Error('No contribution differs from the previous Sleeping Beauty selection');
    const card = player.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: label, exact: true });
    await clickAndConfirm(card, async () => {
      await expect(card).toHaveCount(0);
    });
    contributed.push(label);
  }
  return contributed;
}

async function orderAndRedistribute(host: Page, labels: string[]) {
  const group = host.getByRole('group', { name: 'Sleeping Beauty redistribution' });
  for (const [index, label] of labels.entries()) {
    const card = group.getByRole('button', { name: new RegExp(`${label}$`) });
    await clickAndConfirm(card, async () => {
      await expect(group.getByRole('button', { name: `${index + 1} ${label}` })).toBeVisible();
    });
  }
  const redistribute = group.getByRole('button', { name: 'Redistribute' });
  await clickAndConfirm(redistribute, async () => {
    await expect(group).toHaveCount(0);
  });
}

async function submitRequiredPass(player: Page) {
  const submit = player.locator('.pass-submit');
  const count = Number((await submit.textContent())?.match(/Pass (\d+)/)?.[1]);
  const hand = player.getByRole('region', { name: 'Your hand' });
  for (let index = 0; index < count; index += 1) {
    const card = hand.locator('.playing-card:not(.selected)').first();
    await clickAndConfirm(card, async () => {
      await expect(hand.locator('.playing-card.selected')).toHaveCount(index + 1);
    });
  }
  await clickAndConfirm(submit, async () => {
    await expect(submit).toHaveCount(0);
  });
}

async function openSleepingBeauty(game: PrincessGame) {
  const princess = game.host.getByRole('button', { name: 'Use Sleeping Beauty power' });
  if (await princess.getAttribute('aria-pressed') !== 'true') {
    await clickAndConfirm(princess, async () => {
      await expect(princess).toHaveAttribute('aria-pressed', 'true');
    });
  }
  return princess;
}

test('Sleeping Beauty starts round two without the previous redistribution selection', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Sleeping Beauty resets between rounds', 'Use Sleeping Beauty in consecutive rounds on the same live clients and prove that the second redistribution starts with only its current contributions.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Sleeping Beauty', 'sleeping-reset', ROUND_IDS);

  await openSleepingBeauty(game);
  const beginFirst = page.getByRole('button', { name: 'Begin collection' });
  await clickAndConfirm(beginFirst, async () => {
    await expect(game.jo.getByText('Sleeping Beauty asks you to contribute one card.')).toBeVisible();
  });
  const firstContributions = await contributeOneCard(game.players);
  await orderAndRedistribute(page, firstContributions);
  await declineRemainingBeforeTrickPlayers(game.players);
  for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12);

  for (let play = 0; play < 36; play += 1) await playOneClick(game.players);
  const nextRound = page.getByRole('button', { name: 'Deal round 2' });
  await clickAndConfirm(nextRound, async () => {
    await expect(page.getByText('Round 2 of 5', { exact: true })).toBeVisible();
  });
  const raiseSecondRound = page.getByRole('button', { name: 'Raise hand for Sleeping Beauty on the next trick' });
  await clickAndConfirm(raiseSecondRound, async () => {
    await expect(page.getByText('Hand raised for trick 1')).toBeVisible();
  });
  for (const player of game.players) await submitRequiredPass(player);
  await expect(page.getByRole('alert')).toContainText('Your before-trick decision');

  const princess = page.getByRole('button', { name: 'Use Sleeping Beauty power' });
  await expect(princess).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Begin collection' })).toHaveCount(0);
  await openSleepingBeauty(game);
  const beginSecond = page.getByRole('button', { name: 'Begin collection' });
  await clickAndConfirm(beginSecond, async () => {
    await expect(game.jo.getByText('Sleeping Beauty asks you to contribute one card.')).toBeVisible();
  });
  await expect(beginSecond).toHaveCount(0);

  const secondContributions = await contributeOneCard(game.players, new Set(firstContributions));
  const redistribution = page.getByRole('group', { name: 'Sleeping Beauty redistribution' });
  for (const label of secondContributions) await expect(redistribution.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(redistribution.getByRole('button', { name: 'Redistribute' })).toBeDisabled();

  await steps.step('round-two-selection-empty', { description: 'Bathroom Break begins a fresh Sleeping Beauty redistribution with no hidden assignments from round one', verifications: [
    { spec: 'The collection control is hidden after collection begins', check: async () => expect(beginSecond).toHaveCount(0) },
    { spec: 'All three current contributions are visible and unnumbered', check: async () => { for (const label of secondContributions) await expect(redistribution.getByRole('button', { name: label, exact: true })).toBeVisible(); } },
    { spec: 'Redistribute remains disabled until the current cards are ordered', check: async () => expect(redistribution.getByRole('button', { name: 'Redistribute' })).toBeDisabled() }
  ] });

  await orderAndRedistribute(page, secondContributions);
  await declineRemainingBeforeTrickPlayers(game.players);
  await steps.step('round-two-redistributed', { description: 'Sleeping Beauty assigns exactly the three Bathroom Break contributions and ordinary play resumes', verifications: [
    { spec: 'Every player again holds twelve cards', check: async () => { for (const player of game.players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } },
    { spec: 'The table is no longer waiting for Sleeping Beauty', check: async () => { for (const player of game.players) await expect(player.getByRole('alert')).not.toContainText('Sleeping Beauty'); } },
    { spec: 'Sleeping Beauty is exhausted for round two', check: async () => expect(princess).toBeDisabled() }
  ] });

  steps.generateDocs();
  await closePrincessGame(game);
});
