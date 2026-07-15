import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function ready(page: Page, _princess?: string) {
  await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
}

async function passCards(page: Page, cards: string[], direction: 'left' | 'right') {
  for (const card of cards) {
    const button = page.getByRole('button', { name: card, exact: true });
    await button.click();
    await expect(button).toHaveClass(/selected/);
  }
  await expect(page.locator('.playing-card.selected')).toHaveCount(2);
  const submit = page.getByRole('button', { name: new RegExp(`Pass 2 ${direction} to`) });
  await expect(submit).toBeEnabled();
  await submit.click();
}

async function playNextCards(pages: Page[], observer: Page, startingCount: number, plays: number) {
  let remaining = startingCount;
  for (let index = 0; index < plays; index += 1) {
    let playable: ReturnType<Page['locator']> | null = null;
    for (const candidate of pages) {
      const cards = candidate.locator('.playing-card.playable');
      if (await cards.count()) { playable = cards.first(); break; }
    }
    if (!playable) throw new Error(`No client could play with ${remaining} cards remaining`);
    await playable.click();
    remaining -= 1;
    await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${remaining} cards`);
    for (const client of pages) await expect(client.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${remaining} cards`);
  }
  return remaining;
}

test('the final trick reveals scoring and advances to a refreshed second round', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Round scoring and transition', 'The final live trick reveals Prince and Frog proposals, preserves cumulative totals and Princesses, then redeals with the lowest cumulative scorer leading.');
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'SCORE06P' : 'SCORE06D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options);
  const samContext = await browser.newContext(options);
  const jo = await joContext.newPage();
  const sam = await samContext.newPage();
  const players = [page, jo, sam];

  await page.goto(`/?gameId=${gameId}&seed=scoring-006&e2eUid=score-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await join(jo, gameId, `score-jo-${suffix}`, 'Jo');
  await join(sam, gameId, `score-sam-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(jo, 'The Little Mermaid');
  await ready(sam, 'Cinderella');
  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await page.getByRole('button', { name: round, exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  await passCards(page, ['Fairies 2', 'Fairies 3'], 'left');
  await passCards(jo, ['Fairies 8', 'Fairies 9'], 'left');
  await passCards(sam, ['Fairies 6', 'Fairies 10'], 'left');
  for (const client of players) await expect(client.getByRole('alert')).toContainText('Passing complete');
  await expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 36 cards');

  await playNextCards(players, page, 36, 33);
  await steps.step('final-trick-ready', {
    description: 'The final three cards remain a normal synchronized live trick',
    verifications: [
      { spec: 'Exactly three cards remain across the shared hands', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 3 cards') },
      { spec: 'One trustworthy client is visibly prompted to lead the final trick', check: async () => expect(await Promise.all(players.map((client) => client.locator('.playing-card.playable').count()))).toContain(1) }
    ]
  });

  await playNextCards(players, page, 3, 3);
  const scoring = page.getByLabel('Round 1 scoring');
  await expect(scoring).toBeVisible();
  const nextLead = (await scoring.locator('.next-lead').textContent())?.replace('Lowest total leads next: ', '').trim() ?? '';
  await steps.step('score-round', {
    description: 'The completed round reveals proposal sources and cumulative totals',
    verifications: [
      { spec: 'Every player receives a visible Prince and Frog breakdown', check: async () => {
        for (const name of ['Alex', 'Jo', 'Sam']) await expect(scoring.getByText(name, { exact: true })).toBeVisible();
        await expect(scoring).toContainText('Princes');
        await expect(scoring).toContainText('Frog');
      } },
      { spec: 'The deck’s nine Princes and five-point Frog account for fourteen proposals', check: async () => expect(await scoring.locator('li span').evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.textContent?.match(/= (\d+)/)?.[1] ?? 0), 0))).toBe(14) },
      { spec: 'The unique lowest cumulative scorer is named as the next leader', check: async () => expect(nextLead).toBe('Jo') },
      { spec: 'Princesses stay fixed and only their powers refresh', check: async () => {
        await expect(scoring).toContainText('Princesses stay with their players');
        await expect(page.getByRole('button', { name: 'Ready for round 2' })).toHaveCount(0);
      } }
    ]
  });

  const deal = page.getByRole('button', { name: 'Deal round 2' });
  await expect(deal).toBeEnabled();
  await deal.click();
  await passCards(page, ['Fairies 7', 'Fairies 10'], 'right');
  await passCards(jo, ['Fairies 6', 'Queens 2'], 'right');
  await passCards(sam, ['Fairies 2', 'Fairies 3'], 'right');
  for (const client of players) await expect(client.getByRole('alert')).toContainText('Passing complete');

  await steps.step('next-round-playable', {
    description: 'Fresh hands begin round two under the lowest scorer’s lead',
    verifications: [
      { spec: 'The next Round card and round count are revealed', check: async () => {
        await expect(page.getByLabel('Current Round card')).toContainText('Invitation');
        await expect(page.getByLabel('Current Round card')).toContainText('Round 2 of 5');
      } },
      { spec: 'Every client has a fresh twelve-card hand after the right pass', check: async () => {
        for (const client of players) await expect(client.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12);
      } },
      { spec: 'The lowest cumulative scorer visibly leads the new round', check: async () => {
        const leaderPage = nextLead === 'Alex' ? page : nextLead === 'Jo' ? jo : sam;
        await expect(leaderPage.getByText('You lead', { exact: true })).toBeVisible();
      } },
      { spec: 'The first-round cumulative proposals remain in the projection', check: async () => expect(await page.evaluate(() => {
        const key = Object.keys(localStorage).find((entry) => entry.includes('rebel-princess:game:SCORE06') && entry.endsWith(':reducer:1'));
        const totals = JSON.parse(key ? localStorage.getItem(key) ?? '{}' : '{}').totalScores ?? {};
        return Object.values(totals as Record<string, number>).reduce((sum, score) => sum + score, 0);
      })).toBe(14) }
    ]
  });

  steps.generateDocs();
  await joContext.close();
  await samContext.close();
});
