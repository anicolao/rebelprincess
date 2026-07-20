import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

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
    await page.getByLabel('Your name').fill(name);
    if (!index) await page.getByRole('button', { name: 'Create a game' }).click();
    else { await page.getByLabel('Room code').fill(gameId); await page.getByRole('button', { name: 'Join' }).click(); }
    await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  }
  await host.getByLabel('Choose one of your two Princesses').getByRole('button', { name: princess, exact: true }).click();
  await host.getByRole('button', { name: 'Ready for the ball' }).click();
  for (const page of [jo, sam]) {
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  await host.getByRole('button', { name: 'Shuffle and deal' }).click();
  for (const page of players) {
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.getByRole('button')).toHaveCount(12);
    const submit = page.locator('.pass-submit');
    const count = Number((await submit.textContent())?.match(/Pass (\d+)/)?.[1]);
    for (let index = 0; index < count; index += 1) { await hand.locator('.playing-card:not(.selected)').first().click(); await expect(hand.locator('.playing-card.selected')).toHaveCount(index + 1); }
    await submit.click();
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
  await card.click();
  await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${before - 1} cards`);
  await expect(actor.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: label, exact: true })).toHaveCount(0);
  const actorName = names[players.indexOf(actor)];
  for (const player of players) await expect(player.getByLabel(`${actorName} played ${label}`)).toBeVisible();
  await expect.poll(async () => JSON.stringify(await Promise.all(players.map((page) => page.getByRole('alert').textContent())))).not.toBe(beforeStatuses);
  return label;
}

export async function closePrincessGame(game: PrincessGame) { for (const context of game.contexts) await context.close(); }
