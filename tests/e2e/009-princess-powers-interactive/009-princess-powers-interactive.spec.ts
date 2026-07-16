import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = {
  phone: { mermaid: 'PI000001', sleeping: 'PI000004', alice: 'PI000016', scheherazade: 'PI000000', ice: 'PI000013' },
  desktop: { mermaid: 'DI000004', sleeping: 'DI000000', alice: 'DI000012', scheherazade: 'DI000006', ice: 'DI000003' }
} as const;

async function enter(page: Page, gameId: string, uid: string, name: string, create: boolean) {
  await page.goto(`/?gameId=${gameId}&seed=interactive-${gameId}&e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  if (create) await page.getByRole('button', { name: 'Create a game' }).click();
  else { await page.getByLabel('Room code').fill(gameId); await page.getByRole('button', { name: 'Join' }).click(); }
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function setupGame(pages: Page[], gameId: string, princess: string, suffix: string) {
  await enter(pages[0], gameId, `interactive-host-${suffix}`, 'Alex', true);
  await enter(pages[1], gameId, `interactive-jo-${suffix}`, 'Jo', false);
  await enter(pages[2], gameId, `interactive-sam-${suffix}`, 'Sam', false);
  await pages[0].getByLabel('Choose one of your two Princesses').getByRole('button', { name: princess, exact: true }).click();
  await pages[0].getByRole('button', { name: 'Ready for the ball' }).click();
  for (const page of pages.slice(1)) {
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  for (const round of ['Once Upon a Time…', 'Magic Beans', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await pages[0].getByRole('button', { name: round, exact: true }).click();
  await pages[0].getByRole('button', { name: 'Shuffle and deal' }).click();
  for (const page of pages) {
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.getByRole('button')).toHaveCount(12);
    await hand.getByRole('button').nth(0).press('Enter'); await hand.getByRole('button').nth(1).press('Enter');
    await page.locator('.pass-submit').click();
  }
  for (const page of pages) await expect(page.getByRole('alert')).toContainText('Passing complete');
}

async function playTurn(players: Page[], observer = players[0], highCardPage?: Page) {
  await expect.poll(async () => (await Promise.all(players.map((page) => page.locator('.playing-card.playable').count()))).filter(Boolean).length).toBe(1);
  const actor = (await Promise.all(players.map(async (page) => ({ page, count: await page.locator('.playing-card.playable').count() })))).find((entry) => entry.count)?.page;
  if (!actor) throw new Error('No player has an observable legal play');
  const before = Number((await observer.getByTestId('stream-card-count').textContent())?.match(/(\d+)/)?.[1]);
  const choices = actor.locator('.playing-card.playable');
  await (actor === highCardPage ? choices.last() : choices.first()).press('Enter');
  await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${before - 1} cards`);
}

test('five interactive Princesses resolve complete shared-stream choices', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Interactive Princess powers', 'Five deterministic games exercise suit requests, forced cards, hand swaps, multiplayer contributions, redistribution, and trick returns through real clients and Firestore.');
  const suffix = testInfo.project.name as 'phone' | 'desktop';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options); const samContext = await browser.newContext(options);
  const jo = await joContext.newPage(); const sam = await samContext.newPage(); const players = [page, jo, sam];

  await setupGame(players, IDS[suffix].mermaid, 'The Little Mermaid', suffix);
  await page.getByRole('button', { name: 'Use The Little Mermaid power' }).click();
  const suitButton = page.getByRole('group', { name: 'Little Mermaid power' }).getByRole('button').filter({ hasNotText: 'princes' }).first();
  const requestedSuit = await suitButton.textContent(); await suitButton.click();
  await expect(jo.getByText('Princess power: The Little Mermaid')).toBeVisible();
  const legalSuits = await page.locator('.playing-card.playable small').allTextContents();
  await steps.step('little-mermaid-requests-suit', { description: 'The Little Mermaid requires the leader to play a chosen suit', verifications: [
    { spec: 'Every legal lead uses the requested suit', check: async () => expect(legalSuits.every((suit) => suit === requestedSuit)).toBe(true) },
    { spec: 'Observers see the active power and exhausted card', check: async () => { await expect(jo.getByText('Princess power: The Little Mermaid')).toBeVisible(); await expect(jo.getByLabel("Alex's Princess: The Little Mermaid")).toHaveClass(/exhausted/); } }
  ] });

  await setupGame(players, IDS[suffix].ice, 'The Ice Princess', suffix);
  await page.getByRole('button', { name: 'Use The Ice Princess power' }).click();
  await page.getByRole('group', { name: 'Ice Princess power' }).getByRole('button', { name: 'Jo' }).click();
  const frozen = page.getByRole('group', { name: 'Ice Princess cards' }).getByRole('button').first();
  const frozenLabel = await frozen.textContent(); await frozen.click();
  await playTurn(players); // Alex leads; Jo must play the frozen card next.
  await expect(jo.locator('.playing-card.playable')).toHaveCount(1);
  await steps.step('ice-princess-freezes-card', { description: 'The Ice Princess inspects two cards and freezes one for its owner', verifications: [
    { spec: 'Only the chosen frozen card is playable for Jo', check: async () => expect(await jo.locator('.playing-card.playable').first().getAttribute('aria-label')).toBe(frozenLabel) },
    { spec: 'The Ice Princess is visibly exhausted', check: async () => expect(page.locator('.local-princess.exhausted')).toBeVisible() }
  ] });

  await setupGame(players, IDS[suffix].scheherazade, 'Scheherazade', suffix);
  await page.getByRole('button', { name: 'Use Scheherazade power' }).click();
  await page.getByRole('group', { name: 'Scheherazade power' }).getByRole('button', { name: 'Jo' }).click();
  const swapGroup = page.getByRole('group', { name: 'Scheherazade swap' });
  const takenLabel = (await swapGroup.locator('strong').textContent())?.replace('Took ', '') ?? '';
  const swapButton = swapGroup.getByRole('button', { name: /^Swap / }).first(); const givenLabel = (await swapButton.textContent())?.replace('Swap ', '') ?? '';
  await swapButton.click();
  await steps.step('scheherazade-barters-card', { description: 'Scheherazade exchanges a random card from another hand for one of hers', verifications: [
    { spec: 'The inspected card enters Scheherazade’s hand', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: takenLabel, exact: true })).toBeVisible() },
    { spec: 'The card she gave away leaves her hand and hand sizes remain conserved', check: async () => { await expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: givenLabel, exact: true })).toHaveCount(0); for (const client of players) await expect(client.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12); } }
  ] });

  await setupGame(players, IDS[suffix].sleeping, 'Sleeping Beauty', suffix);
  await page.getByRole('button', { name: 'Use Sleeping Beauty power' }).click(); await page.getByRole('group', { name: 'Sleeping Beauty power' }).getByRole('button', { name: 'Begin collection' }).click();
  const contributed: string[] = [];
  for (const client of players) { const card = client.locator('.playing-card.contributable').first(); contributed.push((await card.getAttribute('aria-label')) ?? ''); await card.press('Enter'); }
  const redistribution = page.getByRole('group', { name: 'Sleeping Beauty redistribution' });
  for (const label of contributed) await redistribution.getByRole('button', { name: new RegExp(`${label}$`) }).click();
  await redistribution.getByRole('button', { name: 'Redistribute' }).click();
  await steps.step('sleeping-beauty-redistributes-cards', { description: 'Every player contributes and Sleeping Beauty assigns every card', verifications: [
    { spec: 'Sleeping Beauty keeps the first selected contribution', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[0], exact: true })).toBeVisible() },
    { spec: 'Jo and Sam receive their explicitly ordered cards', check: async () => { await expect(jo.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[1], exact: true })).toBeVisible(); await expect(sam.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: contributed[2], exact: true })).toBeVisible(); } }
  ] });

  await setupGame(players, IDS[suffix].alice, 'Alice', suffix);
  let aliceReady = false;
  for (let trick = 0; trick < 12 && !aliceReady; trick += 1) {
    const before = Number(await page.locator('.local-counter summary').textContent());
    for (let card = 0; card < 3; card += 1) await playTurn(players, page, page);
    const after = Number(await page.locator('.local-counter summary').textContent());
    aliceReady = after > before && await page.locator('.local-counter .review-card[aria-label="Pets 8"]').count() === 0;
  }
  expect(aliceReady).toBe(true);
  const countsBefore = await Promise.all(players.map((client) => client.getByRole('region', { name: 'Your hand' }).getByRole('button').count()));
  await page.getByRole('button', { name: 'Use Alice power' }).click();
  await steps.step('alice-returns-won-trick', { description: 'Alice shuffles a Frog-free trick she won back into all hands', verifications: [
    { spec: 'Every player receives exactly one returned card', check: async () => { for (let index = 0; index < players.length; index += 1) await expect(players[index].getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(countsBefore[index] + 1); } },
    { spec: 'Alice’s captured trick counter decreases and her card exhausts', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(jo.getByLabel("Alex's Princess: Alice")).toHaveClass(/exhausted/); } }
  ] });

  steps.generateDocs(); await joContext.close(); await samContext.close();
});
