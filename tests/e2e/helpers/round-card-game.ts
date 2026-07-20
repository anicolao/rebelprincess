import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { ROUND_RULES } from '../../../src/lib/setup';
import type { PassDirection } from '../../../src/lib/passing';
import type { TestStepHelper } from './test-step-helper';

export type RoundCardGame = { host: Page; jo: Page; sam: Page; players: Page[]; contexts: BrowserContext[] };

export async function setupRoundCardGame(browser: Browser, host: Page, testInfo: TestInfo, gameId: string, roundName: string, dealSeed = gameId, followingRounds: string[] = [], passNarrative?: { steps: TestStepHelper; direction: PassDirection; count: number }): Promise<RoundCardGame> {
  const options = { viewport: host.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const contexts = [await browser.newContext(options), await browser.newContext(options)];
  const jo = await contexts[0].newPage(); const sam = await contexts[1].newPage();
  const players = [host, jo, sam]; const names = ['Alex', 'Jo', 'Sam'];
  const fallback = ROUND_RULES.map(([, name]) => name).filter((name) => name !== roundName).slice(0, 4);
  const selected = [roundName, ...followingRounds, ...fallback].filter((name, index, names) => names.indexOf(name) === index).slice(0, 5);
  const selectedIds = selected.map((name) => ROUND_RULES.find(([, candidate]) => candidate === name)?.[0]).filter(Boolean).join(',');
  for (const [index, page] of players.entries()) {
    await page.goto(`/?gameId=${gameId}&seed=round-${dealSeed}&e2eRounds=${selectedIds}&e2eUid=round-${names[index]}-${testInfo.project.name}-${gameId}`);
    await page.getByLabel('Your name').fill(names[index]);
    if (!index) await page.getByRole('button', { name: 'Create a game' }).click();
    else { await page.getByLabel('Room code').fill(gameId); await page.getByRole('button', { name: 'Join' }).click(); }
    await expect(page.getByTestId('invite-code')).toHaveText(gameId);
    await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
    await page.getByRole('button', { name: 'Ready for the ball' }).click();
  }
  await host.getByRole('button', { name: 'Shuffle and deal' }).click();
  if (passNarrative) {
    const { steps, direction, count } = passNarrative;
    const hands = players.map((player) => player.getByRole('region', { name: 'Your hand' }));
    for (const hand of hands) await expect(hand.getByRole('button')).toHaveCount(12);
    const before = await Promise.all(hands.map((hand) => hand.getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
    const submit = host.locator('.pass-submit');
    const leftName = 'Jo'; const rightName = 'Sam';
    const destination = direction === 'left' ? leftName : direction === 'right' ? rightName : `${leftName} and ${rightName}`;
    await steps.step('opening-pass-prompt', { description: `${roundName} prints a ${count}-card ${direction} pass before play begins`, verifications: [
      { spec: `The center icon announces Pass ${count} ${direction}`, check: async () => expect(host.getByLabel(`Pass ${count} ${direction}`)).toBeVisible() },
      { spec: `The action names ${destination} as the recipient${direction === 'split' ? 's' : ''}`, check: async () => expect(submit).toHaveText(`Pass ${count} ${direction} to ${destination}`) },
      { spec: 'The pass cannot be committed before any card is chosen', check: async () => expect(submit).toBeDisabled() }
    ] });
    for (let index = 0; index < count; index += 1) {
      const card = hands[0].locator('.playing-card:not(.selected)').first();
      const label = await card.getAttribute('aria-label') ?? '';
      await card.click();
      const expectedRecipient = direction === 'split' ? (index === 0 ? leftName : rightName) : destination;
      await steps.step(`opening-pass-select-${index + 1}`, { description: `Alex clicks ${label}; it is assignment ${index + 1} of ${count} to ${expectedRecipient}`, verifications: [
        { spec: `Exactly ${index + 1} chosen card${index ? 's are' : ' is'} raised`, check: async () => expect(hands[0].locator('.playing-card.selected')).toHaveCount(index + 1) },
        { spec: `${label} stays visibly selected`, check: async () => expect(hands[0].getByRole('button', { name: label, exact: true })).toHaveClass(/selected/) },
        { spec: index + 1 === count ? 'The complete printed pass is ready to commit' : `${count - index - 1} more selection${count - index - 1 === 1 ? ' is' : 's are'} still required`, check: async () => index + 1 === count ? expect(submit).toBeEnabled() : expect(submit).toBeDisabled() }
      ] });
    }
    await submit.click();
    await steps.step('opening-pass-committed', { description: `Alex commits the ${count} cards toward ${destination} while both other players are still choosing`, verifications: [
      { spec: `All ${count} outgoing cards remain visible and raised`, check: async () => expect(hands[0].locator('.playing-card.committed')).toHaveCount(count) },
      { spec: `The waiting message preserves the printed ${direction} direction`, check: async () => expect(host.getByRole('alert')).toContainText(`Passing ${count} ${direction} to ${destination}`) },
      { spec: 'No incoming cards arrive before every player commits', check: async () => expect(await hands[0].getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))).toEqual(before[0]) }
    ] });
    for (let playerIndex = 1; playerIndex < players.length; playerIndex += 1) {
      for (let cardIndex = 0; cardIndex < count; cardIndex += 1) { await hands[playerIndex].locator('.playing-card:not(.selected)').first().click(); await expect(hands[playerIndex].locator('.playing-card.selected')).toHaveCount(cardIndex + 1); }
      await players[playerIndex].locator('.pass-submit').click();
      if (playerIndex === 1) await steps.step('opening-pass-one-waiting', { description: 'Jo commits next; Alex still sees the cards held until Sam makes the final decision', verifications: [
        { spec: 'Exactly one other player remains', check: async () => expect(host.getByRole('alert')).toContainText('Waiting for 1 other player.') },
        { spec: 'Alex can still identify every outgoing card', check: async () => expect(hands[0].locator('.playing-card.committed')).toHaveCount(count) }
      ] });
    }
    for (const page of players) await expect(page.locator('.pass-submit')).toHaveCount(0);
    const sourceIndex = direction === 'left' ? 2 : 1;
    const expectedIncoming = direction === 'split' ? [before[2][0], before[1][1]] : before[sourceIndex].slice(0, count);
    await steps.step('opening-pass-resolved', { description: `Sam commits last; all three ${direction} transfers resolve simultaneously and play can begin`, verifications: [
      { spec: 'Every player again holds twelve cards', check: async () => { for (const hand of hands) await expect(hand.getByRole('button')).toHaveCount(12); } },
      { spec: `Alex receives the exact ${direction} incoming card${count === 1 ? '' : 's'}`, check: async () => { for (const label of expectedIncoming) await expect(hands[0].getByRole('button', { name: label, exact: true })).toBeVisible(); } },
      { spec: 'The table leaves the simultaneous pass phase for play or the Round card’s next action', check: async () => { await expect(host.locator('.pass-submit')).toHaveCount(0); await expect(hands[0].locator('.playing-card.committed')).toHaveCount(0); } }
    ] });
    return { host, jo, sam, players, contexts };
  }
  for (const page of players) {
    const hand = page.getByRole('region', { name: 'Your hand' }); await expect(hand.getByRole('button')).toHaveCount(12);
    const passCount = Number((await page.locator('.pass-icon').getAttribute('aria-label'))?.match(/Pass (\d+)/)?.[1] ?? 1);
    for (let index = 0; index < passCount; index += 1) { await hand.locator('.playing-card:not(.selected)').first().click(); await expect(hand.locator('.playing-card.selected')).toHaveCount(index + 1); }
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
