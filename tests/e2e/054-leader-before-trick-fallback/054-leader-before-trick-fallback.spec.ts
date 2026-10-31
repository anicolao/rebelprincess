import { expect, test } from '@playwright/test';
import { closePrincessGame, setupPrincessGame } from '../helpers/princess-click-game';
import { clickAndConfirm } from '../helpers/round-card-game';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = { phone: 'BAT00000', desktop: 'BAT00001' } as const;

test('the leader can invoke Sleeping Beauty after missing the hand-raise window', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Leader fallback for before-trick powers',
    'A leader who did not raise a hand during passing may still invoke Sleeping Beauty before playing, which opens rolling priority for every eligible player.'
  );
  const game = await setupPrincessGame(
    browser,
    page,
    testInfo,
    IDS[testInfo.project.name as keyof typeof IDS],
    'Sleeping Beauty',
    'leader-fallback',
    'once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs',
    false
  );
  const princess = page.getByRole('button', { name: 'Use Sleeping Beauty power' });

  await steps.step('unsignaled-leader-ready', {
    description: 'The unsignaled leader may either lead a card or invoke Sleeping Beauty',
    verifications: [
      { spec: 'Sleeping Beauty remains enabled after the hand-raise window closes', check: async () => expect(princess).toBeEnabled() },
      { spec: 'Ordinary lead cards remain playable because no player requested priority in advance', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeEnabled() },
      { spec: 'The table identifies Alex as the current leader', check: async () => expect(page.getByText('You lead', { exact: true })).toBeVisible() }
    ]
  });

  await clickAndConfirm(princess, async () => {
    await expect(princess).toHaveAttribute('aria-pressed', 'true');
  });
  const begin = page.getByRole('button', { name: 'Begin collection' });
  await clickAndConfirm(begin, async () => {
    await expect(game.jo.getByText('Sleeping Beauty asks you to contribute one card.')).toBeVisible();
  });

  await steps.step('leader-opens-priority', {
    description: 'Invoking Sleeping Beauty opens and owns the rolling-priority window',
    verifications: [
      { spec: 'Every player is prompted to contribute exactly one card', check: async () => {
        for (const player of game.players) await expect(player.getByText('Sleeping Beauty asks you to contribute one card.')).toBeVisible();
      } },
      { spec: 'No lead card can be played while Sleeping Beauty resolves', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)')).toHaveCount(0) },
      { spec: 'The event-backed collection control replaces the local Begin button', check: async () => expect(begin).toHaveCount(0) }
    ]
  });

  steps.generateDocs();
  await closePrincessGame(game);
});
