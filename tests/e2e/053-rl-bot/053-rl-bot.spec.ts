import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = { phone: 'RLB053P', desktop: 'RLB053D' } as const;

test('a host adds two trained RL bots and plays a complete trick with them', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Playable reinforcement-learning bots',
    'A human host fills an otherwise empty room with two independently authenticated RL bots, then deals, passes, and completes a trick with them.'
  );
  const gameId = IDS[testInfo.project.name as keyof typeof IDS];
  await page.goto(`/?gameId=${gameId}&seed=rl-bot-053&e2eRounds=once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs&e2eUid=rl-host-${testInfo.project.name}`);
  await page.getByLabel('Your name').fill('Alex');
  await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
  await page.getByRole('button', { name: 'Create a game' }).click();

  await page.getByRole('button', { name: 'Add RL bot' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('RL Bot 1');
  await page.getByRole('button', { name: 'Add RL bot' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('RL Bot 2');
  await expect(page.getByRole('list', { name: 'Players' }).getByRole('listitem')).toHaveCount(3);

  const princessOptions = page.getByLabel('Choose one of your two Princesses').getByRole('button');
  await princessOptions.first().click();
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
      { spec: 'Both live controllers report that they are waiting for gameplay', check: async () => expect(page.getByRole('list', { name: 'RL bot status' }).getByText('waiting')).toHaveCount(2) }
    ]
  });

  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  const hand = page.getByRole('region', { name: 'Your hand' });
  const initialCards = hand.locator('.playing-card');
  await expect(initialCards).toHaveCount(12);
  for (let index = 0; index < 3; index += 1) await initialCards.nth(index).click();
  await page.getByRole('button', { name: /Pass 3 (left|right) to RL Bot/ }).click();
  await expect(page.getByRole('alert')).toContainText('Your turn');

  await steps.step('bots-play', {
    description: 'The learned policy passes cards and plays whenever its seat owns the action',
    verifications: [
      { spec: 'The simultaneous pass resolves without either bot retracting its submission', check: async () => expect(page.getByRole('alert')).toContainText('Passing complete') },
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
  await expect(page.getByTestId('bot-controller-count')).toHaveText('2 RL bot controllers loaded');
  await steps.step('bots-recovered', {
    description: 'Reloading the host reconstructs both bot controllers without changing the game',
    verifications: [
      { spec: 'Both independently authenticated bot controllers are restored', check: async () => expect(page.getByTestId('bot-controller-count')).toHaveText('2 RL bot controllers loaded') },
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

  steps.generateDocs();
});
