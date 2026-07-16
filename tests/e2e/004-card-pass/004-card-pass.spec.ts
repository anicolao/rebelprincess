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

async function submitFirstTwo(page: Page, labels: [string, string]) {
  for (const label of labels) await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: /Pass 2 split to/ }).click();
}

async function expectExactHand(page: Page, expected: string[]) {
  const hand = page.getByRole('region', { name: 'Your hand' });
  await expect(hand.locator('.playing-card')).toHaveCount(expected.length);
  for (const label of expected) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible();
}

test('three clients submit simultaneously and resolve a conserved split pass', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Simultaneous card passing',
    'Early submissions reveal no incoming cards; the final submission deterministically resolves all three exact hands without losing or duplicating a card.'
  );
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'PASS004P' : 'PASS004D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const guestContext = await browser.newContext(options);
  const thirdContext = await browser.newContext(options);
  const guest = await guestContext.newPage();
  const third = await thirdContext.newPage();

  await page.goto(`/?gameId=${gameId}&seed=fixed-004&e2eUid=pass-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  await join(guest, gameId, `pass-guest-${suffix}`, 'Jo');
  await join(third, gameId, `pass-third-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(guest, 'The Little Mermaid');
  await ready(third, 'Cinderella');
  for (const round of ['Arranged Marriage', 'Once Upon a Time…', 'Magic Beans', 'Royal Decree', 'Musical Chairs']) await page.getByRole('button', { name: round, exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();

  const passButton = page.getByRole('button', { name: 'Pass 2 split to Jo and Sam' });
  await steps.step('choose-two-cards-prompt', {
    description: 'The host is prompted to choose one card for each neighbor',
    verifications: [
      { spec: 'The pass action names Jo and Sam and is disabled until two cards are chosen', check: async () => expect(passButton).toBeDisabled() },
      { spec: 'The center card states the round rule in text', check: async () => expect(page.getByLabel('Current Round card')).toContainText('A player with no tricks at round end receives 5 proposals.') },
      { spec: 'The center card places one arrow on each side of the single-card count', check: async () => expect(page.getByLabel('Pass 2 split')).toHaveText(/↻\s*1\s*↺/) }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 3', exact: true }).click();
  await steps.step('select-first-card', {
    description: 'The first chosen card rises from the hand',
    verifications: [
      { spec: 'Fairies 3 is visibly selected', check: async () => expect(page.getByRole('button', { name: 'Fairies 3', exact: true })).toHaveClass(/selected/) },
      { spec: 'The next card remains above the raised card so its value stays readable', check: async () => expect(await page.evaluate(() => {
        const next = document.querySelector<HTMLElement>('[aria-label="Fairies 4"]')!;
        const box = next.getBoundingClientRect();
        return document.elementFromPoint(box.left + 2, box.top + 10)?.closest('button')?.getAttribute('aria-label');
      })).toBe('Fairies 4') },
      { spec: 'One card is not enough to pass', check: async () => expect(passButton).toBeDisabled() }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 3', exact: true }).click();
  await steps.step('unselect-first-card', {
    description: 'A selected card can be returned to the hand',
    verifications: [
      { spec: 'Fairies 3 is no longer selected', check: async () => expect(page.getByRole('button', { name: 'Fairies 3', exact: true })).not.toHaveClass(/selected/) },
      { spec: 'The pass action remains disabled', check: async () => expect(passButton).toBeDisabled() }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 3', exact: true }).click();
  await page.getByRole('button', { name: 'Fairies 4', exact: true }).click();
  await steps.step('select-required-cards', {
    description: 'Two selected cards enable the named pass',
    verifications: [
      { spec: 'Both selected cards are visibly raised', check: async () => {
        await expect(page.getByRole('button', { name: 'Fairies 3', exact: true })).toHaveClass(/selected/);
        await expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).toHaveClass(/selected/);
      } },
      { spec: 'The split pass to Jo and Sam is now enabled', check: async () => expect(passButton).toBeEnabled() }
    ]
  });

  await passButton.click();
  await steps.step('commit-pass', {
    description: 'Committed cards remain visible while the host waits',
    verifications: [
      { spec: 'The waiting message identifies both recipients and the split pass', check: async () => expect(page.getByRole('alert')).toContainText('Passing 2 split to Jo and Sam') },
      { spec: 'Each committed card identifies its specific destination', check: async () => {
        await expect(page.getByRole('button', { name: 'Fairies 3' })).toContainText('To Jo');
        await expect(page.getByRole('button', { name: 'Fairies 4' })).toContainText('To Sam');
      } },
      { spec: 'Destination ribbons are left-aligned to remain readable under overlap', check: async () => expect(page.getByRole('button', { name: 'Fairies 3' }).locator('em')).toHaveCSS('text-align', 'left') }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 3' }).click();
  await steps.step('reclaim-committed-card', {
    description: 'Taking back one committed card reopens the choice',
    verifications: [
      { spec: 'Fairies 4 remains selected after the pass is retracted', check: async () => expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).toHaveClass(/selected/) },
      { spec: 'The host must again choose a second card', check: async () => expect(passButton).toBeDisabled() }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 5' }).click();
  await passButton.click();
  await steps.step('commit-revised-pass', {
    description: 'The revised pair is committed to its individual recipients',
    verifications: [
      { spec: 'The retained Fairies 4 still heads right to Sam while its replacement heads left to Jo', check: async () => {
        await expect(page.getByRole('button', { name: 'Fairies 4' })).toContainText('To Sam');
        await expect(page.getByRole('button', { name: 'Fairies 5' })).toContainText('To Jo');
      } },
      { spec: 'The host waits for both other players', check: async () => expect(page.getByRole('alert')).toContainText('Waiting for 2 other players') }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 5' }).click();
  await expect(passButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Fairies 4', exact: true }).click();
  await steps.step('clear-split-pass', {
    description: 'Releasing both cards resets the left and right destination slots',
    verifications: [
      { spec: 'Neither previously committed card remains selected', check: async () => {
        await expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).not.toHaveClass(/selected/);
        await expect(page.getByRole('button', { name: 'Fairies 5', exact: true })).not.toHaveClass(/selected/);
      } },
      { spec: 'A fresh pair is required before passing again', check: async () => expect(passButton).toBeDisabled() }
    ]
  });

  await page.getByRole('button', { name: 'Fairies 4', exact: true }).click();
  await page.getByRole('button', { name: 'Fairies 5', exact: true }).click();
  await passButton.click();
  await steps.step('recommit-reset-pass', {
    description: 'After a full reset, selection order assigns left and then right again',
    verifications: [
      { spec: 'The first new selection heads left to Jo and the second heads right to Sam', check: async () => {
        await expect(page.getByRole('button', { name: 'Fairies 4' })).toContainText('To Jo');
        await expect(page.getByRole('button', { name: 'Fairies 5' })).toContainText('To Sam');
      } }
    ]
  });

  await submitFirstTwo(guest, ['Fairies 2', 'Fairies 8']);
  await expect(page.getByRole('alert')).toContainText('Waiting for 1 other player');
  await submitFirstTwo(third, ['Fairies 10', 'Queens 2']);

  const hostHand = ['Fairies 3', 'Fairies 6', 'Fairies 7', 'Fairies 8', 'Fairies 9', 'Fairies 10', 'Queens 7', 'Princes 2', 'Princes 4', 'Pets 4', 'Pets 6', 'Pets 8'];
  const guestHand = ['Fairies 4', 'Queens 2', 'Queens 4', 'Queens 9', 'Queens 10', 'Princes 3', 'Princes 5', 'Princes 6', 'Princes 7', 'Princes 10', 'Pets 2', 'Pets 5'];
  const thirdHand = ['Fairies 2', 'Fairies 5', 'Queens 3', 'Queens 5', 'Queens 6', 'Queens 8', 'Princes 8', 'Princes 9', 'Pets 3', 'Pets 7', 'Pets 9', 'Pets 10'];
  await expectExactHand(page, hostHand);
  await expectExactHand(guest, guestHand);
  await expectExactHand(third, thirdHand);
  await page.reload();

  await steps.step('resolved-split-pass', {
    description: 'All exact hands resolve after the final hidden submission',
    verifications: [
      { spec: 'The UI reports that simultaneous passing is complete', check: async () => expect(page.getByRole('alert')).toContainText('Passing complete') },
      { spec: 'The host’s revised pass and exact incoming cards survive reload', check: async () => expectExactHand(page, hostHand) },
      { spec: 'All 36 cards remain accounted for after resolution', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 36 cards') },
      { spec: 'Every card preserves the source atlas cell aspect ratio', check: async () => {
        const box = await page.getByRole('region', { name: 'Your hand' }).getByRole('button').first().boundingBox();
        expect(box).not.toBeNull();
        expect(Math.abs((box!.width / box!.height) - (1717 / 3664))).toBeLessThan(0.01);
      } },
      { spec: 'The gameplay table has no horizontal or vertical scrolling', check: async () => expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth === innerWidth, height: document.documentElement.scrollHeight === innerHeight }))).toEqual({ width: true, height: true }) },
      { spec: 'Opponent hand counts remain twelve without revealing their faces', check: async () => {
        await expect(page.getByLabel('Opponents')).toContainText('Jo · 12');
        await expect(page.getByLabel('Opponents')).toContainText('Sam · 12');
        await page.evaluate(() => scrollTo(0, 0));
      } }
    ]
  });

  steps.generateDocs();
  await guestContext.close();
  await thirdContext.close();
});
