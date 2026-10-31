import { expect, test, type Locator, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = { phone: 'RLB053P', desktop: 'RLB053D' } as const;

async function submitRequiredPass(page: Page) {
  const submit = page.locator('.pass-submit');
  await expect(submit).toBeVisible();
  const count = Number((await submit.textContent())?.match(/Pass (\d+)/)?.[1]);
  if (!Number.isInteger(count) || count < 1) throw new Error('The pass control did not report a card count');
  const hand = page.getByRole('region', { name: 'Your hand' });
  for (let index = 0; index < count; index += 1) await hand.locator('.playing-card:not(.selected)').first().click();
  await expect(submit).toBeEnabled();
  await submit.click();
}

async function declineBeforeTrick(page: Page) {
  const decline = page.getByRole('button', { name: 'Decline this time' });
  await expect(decline).toBeVisible();
  await decline.focus();
  await page.keyboard.press('Enter');
}

async function activateCard(page: Page, card: Locator) {
  await expect(card).toBeVisible();
  await card.focus();
  await page.keyboard.press('Enter');
}

async function reachHumanCardDecision(page: Page) {
  const hand = page.getByRole('region', { name: 'Your hand' });
  for (let action = 0; action < 20; action += 1) {
    const playable = hand.locator('.playing-card.playable').first();
    const contribution = hand.locator('.playing-card.contributable').first();
    const decline = page.getByRole('button', { name: 'Decline this time' });
    await expect.poll(async () => await playable.count() + await contribution.count() + await decline.count()).toBeGreaterThan(0);
    if (await playable.count()) return;
    if (await decline.count()) await declineBeforeTrick(page);
    else await activateCard(page, contribution);
  }
  throw new Error('No human card decision after resolving Princess responses');
}

async function finishHumanRound(page: Page, round: number) {
  const hand = page.getByRole('region', { name: 'Your hand' });
  const cards = hand.locator('.playing-card');
  const scoring = page.getByLabel(`Round ${round} scoring`);
  let actions = 0;
  while (!await scoring.isVisible()) {
    const handSize = await cards.count();
    if (!handSize) {
      await expect(scoring).toBeVisible();
      break;
    }
    const contribution = hand.locator('.playing-card.contributable').first();
    const playable = hand.locator('.playing-card.playable').first();
    const decline = page.getByRole('button', { name: 'Decline this time' });
    await expect.poll(async () => Number(await scoring.isVisible()) + await contribution.count() + await playable.count() + await decline.count()).toBeGreaterThan(0);
    if (await scoring.isVisible()) break;
    if (await decline.count()) {
      await declineBeforeTrick(page);
    } else if (await contribution.count()) {
      await activateCard(page, contribution);
      await expect.poll(async () => await contribution.count() === 0 || await scoring.isVisible()).toBe(true);
    } else {
      await activateCard(page, playable);
      await expect.poll(async () => await cards.count() < handSize || await scoring.isVisible()).toBe(true);
    }
    actions += 1;
    if (actions > 30) throw new Error(`Human action limit exceeded in round ${round}`);
  }
  await expect(scoring).toBeVisible();
}

test('a host and two trained RL bots recover and finish a complete game', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Bot difficulty, removal, and complete learned-bot play',
    'A human host selects and removes an Easy bot, then fills the room with two independently authenticated Learned bots, reloads their controllers, and finishes all five rounds with them.'
  );
  const gameId = IDS[testInfo.project.name as keyof typeof IDS];
  await page.goto(`/?gameId=${gameId}&seed=rl-bot-053&e2eRounds=once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs&e2eUid=rl-host-${testInfo.project.name}`);
  await page.getByLabel('Your name').fill('Alex');
  await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
  await page.getByRole('button', { name: 'Create a game' }).click();

  await page.getByLabel('Bot difficulty').selectOption('easy');
  await page.getByRole('button', { name: 'Add Easy bot' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Easy Bot 1');
  await steps.step('bot-controls', {
    description: 'The host chooses a difficulty and can remove a bot before setup locks',
    verifications: [
      { spec: 'Easy is the selected difficulty for the next bot', check: async () => expect(page.getByLabel('Bot difficulty')).toHaveValue('easy') },
      { spec: 'The Easy bot joined through its own authenticated controller', check: async () => expect(page.getByRole('list', { name: 'Bot status' })).toContainText('Easy Bot 1') },
      { spec: 'The host can remove the bot while Princess choices are still open', check: async () => expect(page.getByRole('button', { name: 'Remove Easy Bot 1' })).toBeEnabled() }
    ]
  });
  await page.getByRole('button', { name: 'Remove Easy Bot 1' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).not.toContainText('Easy Bot 1');

  await page.getByLabel('Bot difficulty').selectOption('learned');
  await page.getByRole('button', { name: 'Add Learned bot' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('RL Bot 1');
  await page.getByRole('button', { name: 'Add Learned bot' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('RL Bot 2');
  await expect(page.getByRole('list', { name: 'Players' }).getByRole('listitem')).toHaveCount(3);

  const princessOptions = page.getByLabel('Choose one of your two Princesses');
  await princessOptions.locator('[data-princess-name="Snow White"], [data-princess-name="Alice"]').click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
  await expect(page.getByRole('button', { name: 'Shuffle and deal' })).toBeEnabled();

  await steps.step('bots-ready', {
    description: 'Two trained bots join and seal their own Princess choices',
    verifications: [
      { spec: 'The guest list contains one human and two separately named RL bots', check: async () => {
        const players = page.getByRole('list', { name: 'Players' });
        await expect(players).toContainText('Alex');
        await expect(players).toContainText('RL Bot 1');
        await expect(players).toContainText('RL Bot 2');
      } },
      { spec: 'Every seat is ready after the bots complete sealed Princess commit and reveal', check: async () => expect(page.getByRole('list', { name: 'Players' })).toContainText(/RL Bot 2 · .+Ready/) },
      { spec: 'Both live controllers report that they are waiting for gameplay', check: async () => expect(page.getByRole('list', { name: 'Bot status' }).getByText(/Learned · waiting/)).toHaveCount(2) }
    ]
  });

  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  const hand = page.getByRole('region', { name: 'Your hand' });
  const initialCards = hand.locator('.playing-card');
  await expect(initialCards).toHaveCount(12);
  for (let index = 0; index < 3; index += 1) await initialCards.nth(index).click();
  await page.getByRole('button', { name: /Pass 3 (left|right) to RL Bot/ }).click();
  await reachHumanCardDecision(page);

  await steps.step('bots-play', {
    description: 'The learned policy passes cards and plays whenever its seat owns the action',
    verifications: [
      { spec: 'The simultaneous pass resolves without either bot retracting its submission', check: async () => expect(page.locator('.pass-submit')).toHaveCount(0) },
      { spec: 'The human receives a playable turn after autonomous bot decisions', check: async () => expect(hand.locator('.playing-card.playable').first()).toBeEnabled() },
      { spec: 'Every seat still owns exactly twelve cards after the conserved pass', check: async () => {
        await expect(hand.locator('.playing-card')).toHaveCount(12);
        await expect(page.getByLabel('Opponents')).toContainText('RL Bot 1 · 12');
        await expect(page.getByLabel('Opponents')).toContainText('RL Bot 2 · 12');
      } }
    ]
  });

  await page.reload();
  await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
  await expect(page.getByTestId('bot-controller-count')).toHaveText('2 bot controllers loaded');
  await steps.step('bots-recovered', {
    description: 'Reloading the host reconstructs both bot controllers without changing the game',
    verifications: [
      { spec: 'Both independently authenticated bot controllers are restored', check: async () => expect(page.getByTestId('bot-controller-count')).toHaveText('2 bot controllers loaded') },
      { spec: 'The host returns to the same playable turn with the same twelve-card hand', check: async () => {
        await expect(page.getByRole('alert')).toContainText('Your turn');
        await expect(page.getByRole('region', { name: 'Your hand' }).locator('.playing-card')).toHaveCount(12);
      } },
      { spec: 'Both bot seats remain present after replay', check: async () => {
        await expect(page.getByLabel("RL Bot 1's hand")).toBeVisible();
        await expect(page.getByLabel("RL Bot 2's hand")).toBeVisible();
      } }
    ]
  });

  await hand.locator('.playing-card.playable').first().click();
  await expect(page.getByRole('alert')).toContainText('Trick 2');
  await steps.step('first-trick-complete', {
    description: 'The recovered bots finish the first trick and advance to the next human decision',
    verifications: [
      { spec: 'The table advances to trick two without another human driving the bot seats', check: async () => expect(page.getByRole('alert')).toContainText('Trick 2') },
      { spec: 'The human played exactly one card in the completed trick', check: async () => expect(hand.locator('.playing-card')).toHaveCount(11) },
      { spec: 'Both independently controlled bot seats remain at the table', check: async () => {
        await expect(page.getByLabel("RL Bot 1's hand")).toBeVisible();
        await expect(page.getByLabel("RL Bot 2's hand")).toBeVisible();
      } }
    ]
  });

  await finishHumanRound(page, 1);
  for (let round = 2; round <= 5; round += 1) {
    await page.getByRole('button', { name: `Deal round ${round}` }).click();
    await expect(hand.locator('.playing-card')).toHaveCount(12);
    await submitRequiredPass(page);
    await finishHumanRound(page, round);
  }

  await steps.step('full-game-complete', {
    description: 'The recovered learned bots finish all five rounds with the human host',
    verifications: [
      { spec: 'Every one of the five rounds has an immutable score column', check: async () => expect(page.getByRole('table', { name: 'Five-round score card' }).locator('td.filled')).toHaveCount(15) },
      { spec: 'All 180 dealt cards were legally played through the shared stream', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 0 cards') },
      { spec: 'The game reports a final winner or shared victory', check: async () => expect(page.locator('.victory')).toContainText(/Winner:|Shared victory:/) },
      { spec: 'Both recovered bot controllers remain healthy at game end', check: async () => {
        await expect(page.getByRole('list', { name: 'Bot status' }).getByText(/error/)).toHaveCount(0);
        await expect(page.getByTestId('bot-controller-count')).toHaveText('2 bot controllers loaded');
      } }
    ]
  });

  steps.generateDocs();
});
