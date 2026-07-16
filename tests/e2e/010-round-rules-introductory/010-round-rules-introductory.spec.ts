import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const ROYAL = { phone: { id: 'PR000067', lead: 'Pets 7' }, desktop: { id: 'DR000090', lead: 'Pets 3' } } as const;
const FILLER_ROUNDS = ['Once Upon a Time…', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs', 'Pets’ Revenge', 'Late to the Ball'];

async function enter(page: Page, gameId: string, uid: string, name: string, create: boolean) {
  await page.goto(`/?gameId=${gameId}&seed=round-${gameId}&e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  if (create) await page.getByRole('button', { name: 'Create a game' }).click();
  else { await page.getByLabel('Room code').fill(gameId); await page.getByRole('button', { name: 'Join' }).click(); }
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function setupGame(pages: Page[], gameId: string, round: string, suffix: string) {
  await enter(pages[0], gameId, `round-host-${suffix}`, 'Alex', true);
  await enter(pages[1], gameId, `round-jo-${suffix}`, 'Jo', false);
  await enter(pages[2], gameId, `round-sam-${suffix}`, 'Sam', false);
  for (const page of pages) {
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  for (const name of [round, ...FILLER_ROUNDS.filter((candidate) => candidate !== round).slice(0, 4)]) await pages[0].getByRole('button', { name, exact: true }).click();
  await pages[0].getByRole('button', { name: 'Shuffle and deal' }).click();
  for (const page of pages) {
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.getByRole('button')).toHaveCount(12);
    const count = Number((await page.locator('.pass-submit').textContent())?.match(/Pass (\d+)/)?.[1]);
    for (let index = 0; index < count; index += 1) { await hand.locator('.playing-card:not(.selected)').first().press('Enter'); await expect(hand.locator('.playing-card.selected')).toHaveCount(index + 1); }
    await page.locator('.pass-submit').click();
  }
  for (const page of pages) await expect(page.getByRole('alert')).toContainText(round === 'Late to the Ball' ? 'Late to the Ball' : 'Passing complete');
}

async function playTurn(players: Page[], observer = players[0], page?: Page, label?: string) {
  await expect.poll(async () => (await Promise.all(players.map((client) => client.locator('.playing-card.playable').count()))).filter(Boolean).length).toBe(1);
  const actor = page ?? (await Promise.all(players.map(async (client) => ({ client, count: await client.locator('.playing-card.playable').count() })))).find((entry) => entry.count)?.client;
  if (!actor) throw new Error('No observable legal turn');
  const card = label ? actor.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: label, exact: true }) : actor.locator('.playing-card.playable').first();
  const playedLabel = await card.getAttribute('aria-label');
  await card.press('Enter');
  await expect(actor.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: playedLabel ?? '', exact: true })).toHaveCount(0);
}

async function playTrick(players: Page[]) { for (let index = 0; index < 3; index += 1) await playTurn(players); }

test('six introductory Round cards apply from reveal through resolution', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Introductory Round cards', 'Six deterministic games prove the Deluxe teaching round and every introductory trick, scoring, concealment, exchange, and reserved-card rule through real clients and Firestore.');
  const suffix = testInfo.project.name as 'phone' | 'desktop';
  const prefix = suffix === 'phone' ? 'PX' : 'DX';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options); const samContext = await browser.newContext(options);
  const jo = await joContext.newPage(); const sam = await samContext.newPage(); const players = [page, jo, sam];

  await setupGame(players, `${prefix}000001`, 'Once Upon a Time…', suffix); await playTrick(players);
  await steps.step('once-upon-a-time-base-trick', { description: 'Once Upon a Time leaves a complete trick unchanged', verifications: [
    { spec: 'The card states there is no additional rule', check: async () => expect(page.getByLabel('Current Round card')).toContainText('No additional rule.') },
    { spec: 'Exactly one ordinary trick is awarded', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
  ] });

  await setupGame(players, `${prefix}000003`, 'Masquerade Ball', suffix);
  await playTurn(players); const joCard = await jo.locator('.playing-card.playable').first().getAttribute('aria-label'); await playTurn(players, page, jo);
  await expect(page.getByLabel('Current trick')).toContainText('Jo'); await expect(page.getByLabel('Jo played a face-down card')).toBeVisible();
  await playTurn(players);
  await steps.step('masquerade-reveals-followers', { description: 'Masquerade followers stay face down until every player commits', verifications: [
    { spec: 'The concealed card is revealed as its actual graphic at resolution', check: async () => expect(page.getByLabel(`Jo played ${joCard}`)).toBeVisible() },
    { spec: 'The resolved trick is awarded normally', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
  ] });

  await setupGame(players, ROYAL[suffix].id, 'Royal Decree', suffix);
  await playTurn(players, page, page, ROYAL[suffix].lead);
  const queen = jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: /^Queens / }).first(); const queenLabel = await queen.getAttribute('aria-label'); await playTurn(players, page, jo, queenLabel ?? undefined); await playTurn(players);
  await steps.step('royal-decree-queens-trump', { description: 'An off-suit Queen defeats the higher card of the led suit', verifications: [
    { spec: 'Jo’s off-suit Queen appears in the resolved trick', check: async () => expect(page.getByLabel(`Jo played ${queenLabel}`)).toBeVisible() },
    { spec: 'Royal Decree awards that trick to Jo', check: async () => expect(jo.locator('.local-counter summary')).toHaveText('1') }
  ] });

  await setupGame(players, `${prefix}000004`, 'Musical Chairs', suffix); await playTrick(players);
  for (const client of players) await expect(client.getByRole('alert')).toContainText('Musical Chairs');
  const chairCards: string[] = [];
  for (const client of players) { const card = client.locator('.playing-card.contributable').first(); chairCards.push((await card.getAttribute('aria-label')) ?? ''); await card.press('Enter'); }
  await steps.step('musical-chairs-passes-right', { description: 'After the trick, everyone simultaneously passes one card right', verifications: [
    { spec: 'Every hand remains the same size after the exchange', check: async () => { for (const client of players) await expect(client.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11); } },
    { spec: 'Each player receives the card from their left', check: async () => { await expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chairCards[1], exact: true })).toBeVisible(); await expect(jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chairCards[2], exact: true })).toBeVisible(); await expect(sam.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: chairCards[0], exact: true })).toBeVisible(); } }
  ] });

  await setupGame(players, `${prefix}000005`, 'Pets’ Revenge', suffix); for (let index = 0; index < 36; index += 1) await playTurn(players);
  const scoreRows = await page.locator('.round-results li span').allTextContents();
  await steps.step('pets-revenge-scores-every-pet', { description: 'Pets’ Revenge adds one proposal for every captured Pet', verifications: [
    { spec: 'The scoring breakdown names the Round-rule additions', check: async () => expect(scoreRows.some((row) => row.includes('Round rule'))).toBe(true) },
    { spec: 'All nine three-player Pets are counted exactly once', check: async () => expect(scoreRows.reduce((sum, row) => sum + Number(row.match(/\+ (\d+) Round rule/)?.[1] ?? 0), 0)).toBe(9) }
  ] });

  await setupGame(players, `${prefix}000006`, 'Late to the Ball', suffix);
  const reserved: string[] = [];
  for (const client of players) { const card = client.locator('.playing-card.contributable').first(); reserved.push((await card.getAttribute('aria-label')) ?? ''); await card.press('Enter'); }
  for (const client of players) await expect(client.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(11);
  for (let index = 0; index < 33; index += 1) await playTurn(players);
  for (let index = 0; index < players.length; index += 1) await expect(players[index].getByRole('region', { name: 'Your hand' }).getByRole('button', { name: reserved[index], exact: true })).toBeVisible();
  await steps.step('late-to-ball-reserves-final-card', { description: 'Each reserved card returns as its owner’s only final-trick card', verifications: [
    { spec: 'Every player has exactly their reserved card for the final trick', check: async () => { for (let index = 0; index < players.length; index += 1) { const hand = players[index].getByRole('region', { name: 'Your hand' }).getByRole('button'); await expect(hand).toHaveCount(1); await expect(hand).toHaveAttribute('aria-label', reserved[index]); } } },
    { spec: 'The table announces the final trick', check: async () => expect(page.getByRole('alert')).toContainText('Trick 12') }
  ] });
  for (let index = 0; index < 3; index += 1) await playTurn(players); await expect(page.getByRole('alert')).toContainText('Round 1 complete');

  steps.generateDocs(); await joContext.close(); await samContext.close();
});
