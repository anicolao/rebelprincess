import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { clickAndConfirm } from './round-card-game';

export type PrincessGame = { host: Page; jo: Page; sam: Page; players: Page[]; contexts: BrowserContext[] };

export async function setupPrincessGame(browser: Browser, host: Page, testInfo: TestInfo, gameId: string, princess: string, seedPrefix = 'power'): Promise<PrincessGame> {
  const options = { viewport: host.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const contexts = [await browser.newContext(options), await browser.newContext(options)];
  const jo = await contexts[0].newPage(); const sam = await contexts[1].newPage();
  const players = [host, jo, sam];
  const suffix = testInfo.project.name;
  for (const [index, page] of players.entries()) {
    const name = ['Alex', 'Jo', 'Sam'][index];
    await page.goto(`/?gameId=${gameId}&seed=${seedPrefix}-${gameId}&e2eRounds=once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs&e2eUid=click-${name}-${suffix}-${gameId}`);
    await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
    await page.getByLabel('Your name').fill(name);
    if (!index) {
      const createBtn = page.getByRole('button', { name: 'Create a game' });
      await clickAndConfirm(createBtn, async () => {
        await expect(page.getByTestId('invite-code')).toHaveText(gameId);
      });
    } else {
      await page.getByLabel('Room code').fill(gameId);
      const joinBtn = page.getByRole('button', { name: 'Join' });
      await clickAndConfirm(joinBtn, async () => {
        await expect(page.getByTestId('invite-code')).toHaveText(gameId);
      });
    }
  }
  const hostPrincessBtn = host.getByLabel('Choose one of your two Princesses').getByRole('button', { name: princess, exact: true });
  await clickAndConfirm(hostPrincessBtn, async () => {
    await expect(hostPrincessBtn).toHaveAttribute('aria-pressed', 'true');
  });
  const hostReadyBtn = host.getByRole('button', { name: 'Ready for the ball' });
  await clickAndConfirm(hostReadyBtn, async () => {
    await expect(hostReadyBtn).toHaveCount(0);
  });
  for (const page of [jo, sam]) {
    const princessBtn = page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first();
    await clickAndConfirm(princessBtn, async () => {
      await expect(princessBtn).toHaveAttribute('aria-pressed', 'true');
    });
    const readyBtn = page.getByRole('button', { name: 'Ready for the ball' });
    await clickAndConfirm(readyBtn, async () => {
      await expect(readyBtn).toHaveCount(0);
    });
  }
  const shuffleBtn = host.getByRole('button', { name: 'Shuffle and deal' });
  await clickAndConfirm(shuffleBtn, async () => {
    await expect(shuffleBtn).toHaveCount(0);
  });
  for (const page of players) {
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.getByRole('button')).toHaveCount(12);
    const submit = page.locator('.pass-submit');
    const count = Number((await submit.textContent())?.match(/Pass (\d+)/)?.[1]);
    for (let index = 0; index < count; index += 1) {
      const card = hand.locator('.playing-card:not(.selected)').first();
      const label = await card.getAttribute('aria-label') ?? '';
      const specificCard = hand.getByRole('button', { name: label, exact: true });
      await clickAndConfirm(specificCard, async () => {
        await expect(hand.locator('.playing-card.selected')).toHaveCount(index + 1);
      });
    }
    await clickAndConfirm(submit, async () => {
      await expect(submit).toHaveCount(0);
    });
  }
  for (const page of players) await expect(page.getByRole('alert')).toContainText('Passing complete');
  return { host, jo, sam, players, contexts };
}

export async function playOneClick(players: Page[], observer = players[0], chooseLast: boolean | Page = false): Promise<string> {
  const names = ['Alex', 'Jo', 'Sam'];
  await expect.poll(async () => {
    const statuses = await Promise.all(players.map((page) => page.getByRole('alert').textContent()));
    const active = statuses.findIndex((status) => status?.includes('Your turn'));
    return active >= 0 && statuses.every((status, index) => index === active || status?.includes(`Waiting for ${names[active]}`)) ? active : -1;
  }).toBeGreaterThanOrEqual(0);
  const actor = (await Promise.all(players.map(async (page) => ({ page, active: (await page.getByRole('alert').textContent())?.includes('Your turn') })))).find((entry) => entry.active)?.page;
  if (!actor) throw new Error('No player has an observable legal play');
  const cards = actor.locator('.playing-card.playable:not(:disabled)');
  const card = chooseLast === true || chooseLast === actor ? cards.last() : cards.first();
  await expect(card).toBeEnabled();
  const label = await card.getAttribute('aria-label') ?? '';
  const before = Number((await observer.getByTestId('stream-card-count').textContent())?.match(/(\d+)/)?.[1]);
  const beforeStatuses = JSON.stringify(await Promise.all(players.map((page) => page.getByRole('alert').textContent())));

  const specificCard = actor.getByRole('button', { name: label, exact: true });
  await clickAndConfirm(specificCard, async () => {
    await expect(specificCard).toHaveCount(0);
  });

  await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${before - 1} cards`);
  const actorName = names[players.indexOf(actor)];
  for (const player of players) await expect(player.getByLabel(`${actorName} played ${label}`)).toBeVisible();
  await expect.poll(async () => JSON.stringify(await Promise.all(players.map((page) => page.getByRole('alert').textContent())))).not.toBe(beforeStatuses);
  return label;
}

export async function closePrincessGame(game: PrincessGame) { for (const context of game.contexts) await context.close(); }
