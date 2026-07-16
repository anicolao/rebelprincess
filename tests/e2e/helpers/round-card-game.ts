import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { ROUND_RULES } from '../../../src/lib/setup';

export type RoundCardGame = { host: Page; jo: Page; sam: Page; players: Page[]; contexts: BrowserContext[] };

export async function setupRoundCardGame(browser: Browser, host: Page, testInfo: TestInfo, gameId: string, roundName: string, dealSeed = gameId): Promise<RoundCardGame> {
  const options = { viewport: host.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const contexts = [await browser.newContext(options), await browser.newContext(options)];
  const jo = await contexts[0].newPage(); const sam = await contexts[1].newPage();
  const players = [host, jo, sam]; const names = ['Alex', 'Jo', 'Sam'];
  for (const [index, page] of players.entries()) {
    await page.goto(`/?gameId=${gameId}&seed=round-${dealSeed}&e2eUid=round-${names[index]}-${testInfo.project.name}-${gameId}`);
    await page.getByLabel('Your name').fill(names[index]);
    if (!index) await page.getByRole('button', { name: 'Create a game' }).click();
    else { await page.getByLabel('Room code').fill(gameId); await page.getByRole('button', { name: 'Join' }).click(); }
    await expect(page.getByTestId('invite-code')).toHaveText(gameId);
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  const fallback = ROUND_RULES.map(([, name]) => name).filter((name) => name !== roundName).slice(0, 4);
  for (const name of [roundName, ...fallback]) await host.getByRole('button', { name, exact: true }).click();
  await host.getByRole('button', { name: 'Shuffle and deal' }).click();
  for (const page of players) {
    const hand = page.getByRole('region', { name: 'Your hand' }); await expect(hand.getByRole('button')).toHaveCount(12);
    const passCount = Number((await page.locator('.pass-icon').getAttribute('aria-label'))?.match(/Pass (\d+)/)?.[1] ?? 1);
    for (let index = 0; index < passCount; index += 1) await hand.getByRole('button').nth(index).click();
    await page.locator('.pass-submit').click();
  }
  for (const page of players) await expect(page.locator('.pass-submit')).toHaveCount(0);
  return { host, jo, sam, players, contexts };
}

export async function clickCurrentCard(players: Page[], chooseLast: boolean | ((actor: string) => boolean) = false): Promise<{ actor: string; card: string }> {
  const names = ['Alex', 'Jo', 'Sam'];
  await expect.poll(async () => (await Promise.all(players.map((page) => page.locator('.playing-card.playable:not(:disabled)').count()))).findIndex((count) => count > 0)).toBeGreaterThanOrEqual(0);
  const counts = await Promise.all(players.map((page) => page.locator('.playing-card.playable:not(:disabled)').count()));
  const index = counts.findIndex((count) => count > 0); const cards = players[index].locator('.playing-card.playable:not(:disabled)');
  const pickLast = typeof chooseLast === 'function' ? chooseLast(names[index]) : chooseLast;
  const card = pickLast ? cards.last() : cards.first(); const label = await card.getAttribute('aria-label') ?? '';
  await card.click();
  for (const page of players) await expect(page.getByLabel(`${names[index]} played ${label}`)).toBeVisible();
  return { actor: names[index], card: label };
}

export async function closeRoundCardGame(game: RoundCardGame) { for (const context of game.contexts) await context.close(); }
