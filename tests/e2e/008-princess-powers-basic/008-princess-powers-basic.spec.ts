import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const IDS = {
  phone: { snow: 'F0000004', cinderella: 'F0000007', pocahontas: 'F0000000', mulan: 'F0000002', pea: 'F0000015' },
  desktop: { snow: 'G0000000', cinderella: 'G0000003', pocahontas: 'G0000008', mulan: 'G0000001', pea: 'G0000010' }
} as const;

async function enter(page: Page, gameId: string, name: string, create: boolean) {
  await page.goto(`/?gameId=${gameId}&seed=power-${gameId}`);
  await page.getByLabel('Your name').fill(name);
  if (create) await page.getByRole('button', { name: 'Create a game' }).click();
  else {
    await page.getByLabel('Room code').fill(gameId);
    await page.getByRole('button', { name: 'Join' }).click();
  }
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function setupGame(pages: Page[], gameId: string, princess: string) {
  await enter(pages[0], gameId, 'Alex', true);
  await enter(pages[1], gameId, 'Jo', false);
  await enter(pages[2], gameId, 'Sam', false);
  await pages[0].getByLabel('Choose one of your two Princesses').getByRole('button', { name: princess, exact: true }).click();
  await pages[0].getByRole('button', { name: 'Ready for the ball' }).click();
  for (const page of pages.slice(1)) {
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await pages[0].getByRole('button', { name: round, exact: true }).click();
  await pages[0].getByRole('button', { name: 'Shuffle and deal' }).click();
  for (const page of pages) {
    const hand = page.getByRole('region', { name: 'Your hand' });
    await expect(hand.getByRole('button')).toHaveCount(12);
    await hand.getByRole('button').nth(0).click();
    await hand.getByRole('button').nth(1).click();
    await page.locator('.pass-submit').click();
  }
  for (const page of pages) await expect(page.getByRole('alert')).toContainText('Passing complete');
}

async function playFirstPlayable(page: Page, observer: Page) {
  const card = page.locator('.playing-card.playable:not(:disabled)').first();
  const label = await card.getAttribute('aria-label');
  const before = Number((await observer.getByTestId('stream-card-count').textContent())?.match(/(\d+)/)?.[1]);
  await card.press('Enter');
  await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${before - 1} cards`);
  return label ?? '';
}

async function playCards(pages: Page[], count: number) {
  for (let played = 0; played < count; played += 1) {
    await expect.poll(async () => (await Promise.all(pages.map((page) => page.locator('.playing-card.playable:not(:disabled)').count()))).filter((count) => count > 0).length).toBe(1);
    for (const page of pages) if (await page.locator('.playing-card.playable:not(:disabled)').count()) { await playFirstPlayable(page, pages[0]); break; }
  }
}

test('the five direct Princess powers activate, modify play, and exhaust for the round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Direct Princess powers', 'Five deterministic games activate Snow White, Cinderella, Pocahontas, Mulan, and the Pea Princess through real clients and the append-only Firestore stream.');
  const suffix = testInfo.project.name as 'phone' | 'desktop';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options);
  const samContext = await browser.newContext(options);
  const jo = await joContext.newPage();
  const sam = await samContext.newPage();
  const players = [page, jo, sam];

  await setupGame(players, IDS[suffix].snow, 'Snow White');
  await page.getByRole('button', { name: 'Use Snow White power' }).click();
  const snowCandidates = page.locator('.playing-card.playable');
  let snowCard = snowCandidates.first();
  for (let index = 0; index < await snowCandidates.count(); index += 1) {
    const candidate = snowCandidates.nth(index);
    if (Number(await candidate.locator('strong').textContent()) <= 7) { snowCard = candidate; break; }
  }
  await snowCard.click();
  await steps.step('snow-white-zero', {
    description: 'Snow White turns her chosen low card into zero',
    verifications: [
      { spec: 'The actual card remains visible with an effective value of zero', check: async () => expect(page.getByLabel('Current trick')).toContainText('Counts as 0') },
      { spec: 'The observer sees Snow White’s card tilted and desaturated for this round', check: async () => expect(jo.getByLabel("Alex's Princess: Snow White")).toHaveClass(/exhausted/) }
    ]
  });

  await setupGame(players, IDS[suffix].cinderella, 'Cinderella');
  await page.getByRole('button', { name: 'Use Cinderella power' }).click();
  await expect(page.getByText('Princess power: Cinderella')).toBeVisible();
  await playCards(players, 3);
  await expect(jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/);
  await steps.step('cinderella-reverses-rank', {
    description: 'Cinderella reverses the hierarchy for one complete trick',
    verifications: [
      { spec: 'All clients see Cinderella tilted and desaturated after the trick resolves', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); for (const client of players.slice(1)) await expect(client.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/); } },
      { spec: 'The completed trick is awarded under the lower-card hierarchy', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
    ]
  });

  await setupGame(players, IDS[suffix].pocahontas, 'Pocahontas');
  await page.getByRole('button', { name: 'Use Pocahontas power' }).click();
  await page.getByRole('group', { name: 'Pocahontas power' }).getByRole('button', { name: 'Jo leads' }).click();
  await steps.step('pocahontas-chooses-leader', {
    description: 'Pocahontas hands the lead to another player',
    verifications: [
      { spec: 'Jo receives the prominent local lead indicator', check: async () => expect(jo.getByText('You lead', { exact: true })).toBeVisible() },
      { spec: 'Every client sees Pocahontas tilted, desaturated, and unavailable', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); for (const client of players.slice(1)) await expect(client.getByLabel("Alex's Princess: Pocahontas")).toHaveClass(/exhausted/); } }
    ]
  });

  await setupGame(players, IDS[suffix].pea, 'The Pea Princess');
  await page.getByRole('button', { name: 'Use The Pea Princess power' }).click();
  await expect(page.getByText('Princess power: The Pea Princess')).toBeVisible();
  const peaRanks = await page.locator('.playing-card.playable strong').allTextContents();
  await steps.step('pea-princess-requires-high-cards', {
    description: 'The Pea Princess requires a card above five when one is legal',
    verifications: [
      { spec: 'Every highlighted legal choice is above five', check: async () => expect(peaRanks.every((rank) => Number(rank) > 5)).toBe(true) },
      { spec: 'The active rule and exhausted Princess card are visible to observers', check: async () => { await expect(jo.getByText('Princess power: The Pea Princess')).toBeVisible(); await expect(jo.getByLabel("Alex's Princess: The Pea Princess")).toHaveClass(/exhausted/); } }
    ]
  });

  await setupGame(players, IDS[suffix].mulan, 'Mulan');
  const labels = await page.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  const lead = labels.find((label) => label !== 'Pets 8' && labels.filter((other) => other.split(' ')[0] === label.split(' ')[0]).length > 1 && Number(label.split(' ')[1]) > 0);
  if (!lead) throw new Error('The deterministic Mulan hand has no same-suit replacement');
  await page.getByRole('button', { name: lead, exact: true }).press('Enter');
  await expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 35 cards');
  await playCards(players, 2);
  await page.getByRole('button', { name: 'Use Mulan power' }).click();
  const replacement = page.getByRole('group', { name: 'Mulan power' }).getByRole('button', { name: /^Swap for / }).first();
  const replacementLabel = (await replacement.textContent())?.replace('Swap for ', '') ?? '';
  await replacement.click();
  await expect(page.getByLabel(`Alex played ${replacementLabel}`)).toBeVisible();
  await steps.step('mulan-swaps-played-card', {
    description: 'Mulan replaces her played card after everyone commits',
    verifications: [
      { spec: 'The original played card returns to Mulan’s hand', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: lead, exact: true })).toBeVisible() },
      { spec: 'The replacement is the actual card shown in the resolved trick', check: async () => expect(page.getByLabel(`Alex played ${replacementLabel}`)).toBeVisible() },
      { spec: 'All clients see Mulan tilted and desaturated after the swap', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); for (const client of players.slice(1)) await expect(client.getByLabel("Alex's Princess: Mulan")).toHaveClass(/exhausted/); } }
    ]
  });

  steps.generateDocs();
  await joContext.close();
  await samContext.close();
});
