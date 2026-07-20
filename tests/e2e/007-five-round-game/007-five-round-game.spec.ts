import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const EXPECTED_SCORES = [
  [[7, 0, 7, 7, 0], [0, 0, 0, 0, 1], [2, 5, 7, 7, 0]],
  [[0, 0, 0, 7, 1], [4, 0, 4, 4, 1], [5, 5, 10, 17, 0]],
  [[4, 0, 4, 11, 1], [5, 5, 10, 14, 1], [0, 0, 0, 17, 1]],
  [[1, 5, 6, 17, 1], [8, 0, 8, 22, 1], [0, 0, 0, 17, 2]],
  [[0, 0, 0, 17, 2], [7, 0, 7, 29, 1], [2, 5, 7, 24, 2]]
] as const;

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function ready(page: Page) {
  await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
}

async function submitRequiredPass(page: Page) {
  const submit = page.locator('.pass-submit');
  const count = Number((await submit.textContent())?.match(/Pass (\d+)/)?.[1]);
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('region', { name: 'Your hand' }).locator('.playing-card:not(.selected)').first().click();
    await expect(page.locator('.playing-card.selected')).toHaveCount(index + 1);
  }
  await expect(submit).toBeEnabled();
  await submit.click();
}

async function playCompleteRound(players: Page[], observer: Page) {
  let remaining = 36;
  while (remaining > 0) {
    if (await observer.getByRole('alert').filter({ hasText: 'Musical Chairs' }).count()) {
      for (const player of players) await player.locator('.playing-card.contributable').first().press('Enter');
      await expect(observer.getByRole('alert')).toContainText('Trick');
      continue;
    }
    await expect.poll(async () => (await Promise.all(players.map((player) => player.locator('.playing-card.playable').count()))).filter((count) => count > 0).length).toBe(1);
    let playable: ReturnType<Page['locator']> | null = null;
    for (const player of players) {
      const cards = player.locator('.playing-card.playable');
      if (await cards.count()) { playable = cards.first(); break; }
    }
    if (!playable) throw new Error(`No legal play with ${remaining} cards remaining`);
    await playable.click();
    await expect(observer.getByTestId('stream-card-count')).toHaveText(`Shared stream contains ${remaining - 1} cards`);
    remaining -= 1;
  }
}

function scoreRows(page: Page, round: number) {
  return page.getByLabel(`Round ${round} scoring`).locator('li');
}

test('three players complete every pass, card, trick, and score across all five rounds', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Complete five-round game', 'Three real clients play all 180 dealt cards through the append-only Firestore stream, verify every round score and cumulative total, resolve the final tie-break, and begin a rematch.');
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'FULL07P' : 'FULL07D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options);
  const samContext = await browser.newContext(options);
  const jo = await joContext.newPage();
  const sam = await samContext.newPage();
  const players = [page, jo, sam];

  await page.goto(`/?gameId=${gameId}&seed=complete-007&e2eRounds=once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs&e2eUid=full-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await join(jo, gameId, `full-jo-${suffix}`, 'Jo');
  await join(sam, gameId, `full-sam-${suffix}`, 'Sam');
  for (const player of players) await ready(player);
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();

  for (let round = 1; round <= 5; round += 1) {
    for (const player of players) await expect(player.getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(12);
    for (const player of players) await submitRequiredPass(player);
    for (const player of players) await expect(player.getByRole('alert')).toContainText('Passing complete');
    await playCompleteRound(players, page);

    const scoring = page.getByLabel(`Round ${round} scoring`);
    await expect(scoring).toBeVisible();
    await expect(scoreRows(page, round)).toHaveCount(3);
    const roundTotal = await scoreRows(page, round).locator('span').evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.textContent?.match(/= (\d+)/)?.[1] ?? 0), 0));
    expect(roundTotal).toBe(14);
    const cumulativeTotal = await scoreRows(page, round).locator('b').evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.textContent?.match(/^(\d+) total/)?.[1] ?? 0), 0));
    expect(cumulativeTotal).toBe(round * 14);
    for (const [index, name] of ['Alex', 'Jo', 'Sam'].entries()) {
      const [princes, frog, score, cumulative, zeroRounds] = EXPECTED_SCORES[round - 1][index];
      const row = scoreRows(page, round).nth(index);
      await expect(row).toContainText(name);
      await expect(row).toContainText(`${princes} Princes + ${frog} Frog = ${score}`);
      await expect(row).toContainText(`${cumulative} total · ${zeroRounds} zero rounds`);
    }

    if (round === 1) await steps.step('first-round-complete', {
      description: 'All thirty-six cards produce a complete first-round score',
      verifications: [
        { spec: 'The round accounts for all nine Princes and the five-point Frog', check: async () => expect(roundTotal).toBe(14) },
        { spec: 'All three clients see the completed round', check: async () => { for (const player of players) await expect(player.getByRole('alert')).toContainText('Round 1 complete'); } }
      ]
    });

    if (round < 5) {
      await page.getByRole('button', { name: `Deal round ${round + 1}` }).click();
      for (const player of players) await expect(player.getByLabel('Current Round card')).toContainText(`Round ${round + 1} of 5`);
    }
  }

  const final = page.getByLabel('Round 5 scoring');
  await steps.step('final-game-result', {
    description: 'The fifth score resolves the immutable game result',
    verifications: [
      { spec: 'Exactly 180 cards were legally played over five full rounds', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 0 cards') },
      { spec: 'The five round totals account for seventy proposals', check: async () => expect(await final.locator('li b').evaluateAll((rows) => rows.reduce((sum, row) => sum + Number(row.textContent?.match(/^(\d+) total/)?.[1] ?? 0), 0))).toBe(70) },
      { spec: 'Every final row reports its zero-proposal round tie-break count', check: async () => { for (const row of await final.locator('li').all()) await expect(row).toContainText('zero rounds'); } },
      { spec: 'Every client sees the same named winner or shared victory', check: async () => {
        for (const player of players) await expect(player.locator('.victory')).toHaveText('Winner: Alex');
      } }
    ]
  });

  await page.getByRole('button', { name: 'Rematch' }).click();
  await steps.step('rematch-setup', {
    description: 'The append-only rematch returns the same players to fresh setup',
    verifications: [
      { spec: 'Membership and display names carry into the rematch', check: async () => { for (const name of ['Alex', 'Jo', 'Sam']) await expect(page.getByRole('list', { name: 'Players' })).toContainText(name); } },
      { spec: 'Princess choices and ready state reset for the new game', check: async () => expect(page.getByLabel('Choose one of your two Princesses')).toBeVisible() },
      { spec: 'Every client leaves the immutable final table together', check: async () => { for (const player of players) await expect(player.getByTestId('invite-code')).toHaveText(gameId); } }
    ]
  });

  steps.generateDocs();
  await joContext.close();
  await samContext.close();
});
