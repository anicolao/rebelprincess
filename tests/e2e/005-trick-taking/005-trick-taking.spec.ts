import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function ready(page: Page, princess: string) {
  await page.getByRole('button', { name: princess, exact: true }).click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
}

async function pass(page: Page, cards: string[]) {
  for (const card of cards) await page.getByRole('button', { name: card, exact: true }).click();
  await page.getByRole('button', { name: /^Pass 2/ }).click();
}

async function play(page: Page, card: string) {
  await page.getByRole('button', { name: card, exact: true }).click();
}

test('three clients follow suit, break Princes, resolve winners, and rotate leadership', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Base trick-taking loop', 'Three trustworthy clients play complete synchronized tricks through follow-suit, void, Prince-breaking, capture, and winner-led transitions.');
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'TRICK05P' : 'TRICK05D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options);
  const samContext = await browser.newContext(options);
  const jo = await joContext.newPage();
  const sam = await samContext.newPage();

  await page.goto(`/?gameId=${gameId}&seed=fixed-004&e2eUid=trick-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  await join(jo, gameId, `trick-jo-${suffix}`, 'Jo');
  await join(sam, gameId, `trick-sam-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(jo, 'The Little Mermaid');
  await ready(sam, 'Cinderella');
  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await page.getByRole('button', { name: round, exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  await pass(page, ['Fairies 3', 'Princes 2']);
  await pass(jo, ['Fairies 2', 'Fairies 8']);
  await pass(sam, ['Fairies 10', 'Queens 2']);

  await steps.step('leader-legal-cards', {
    description: 'The leader may play non-Princes but cannot lead an unbroken Prince',
    verifications: [
      { spec: 'Alex is prompted to lead the first trick', check: async () => expect(page.getByRole('alert')).toContainText('Your turn') },
      { spec: 'A Prince is disabled before the suit is broken', check: async () => expect(page.getByRole('button', { name: 'Princes 4', exact: true })).toBeDisabled() },
      { spec: 'A Fairy is a legal opening lead', check: async () => expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).toBeEnabled() }
    ]
  });

  await play(page, 'Fairies 4');
  await steps.step('observer-sees-lead', {
    description: 'Every client sees the lead and Jo must follow suit',
    verifications: [
      { spec: 'The shared trick shows Alex’s Fairy 4', check: async () => expect(page.getByLabel('Current trick')).toContainText('Alex: Fairies 4') },
      { spec: 'Jo can follow with a Fairy', check: async () => expect(jo.getByRole('button', { name: 'Fairies 3', exact: true })).toBeEnabled() },
      { spec: 'Jo cannot discard an off-suit Prince while holding Fairies', check: async () => expect(jo.getByRole('button', { name: 'Princes 3', exact: true })).toBeDisabled() }
    ]
  });

  await play(jo, 'Fairies 3');
  await play(sam, 'Fairies 8');
  await expect(sam.getByRole('alert')).toContainText('Your turn');
  await play(sam, 'Queens 3');
  await play(page, 'Queens 7');
  await play(jo, 'Queens 4');
  await expect(page.getByRole('alert')).toContainText('Your turn');
  await play(page, 'Fairies 5');

  await steps.step('void-breaks-princes', {
    description: 'A void player may discard a Prince and break the suit',
    verifications: [
      { spec: 'Jo has no Fairies remaining and may play a Prince', check: async () => expect(jo.getByRole('button', { name: 'Princes 10', exact: true })).toBeEnabled() },
      { spec: 'The current trick is synchronized through Alex’s lead', check: async () => expect(jo.getByLabel('Current trick')).toContainText('Alex: Fairies 5') }
    ]
  });

  await play(jo, 'Princes 10');
  await play(sam, 'Fairies 2');
  await expect(page.getByRole('alert')).toContainText('Your turn');

  await steps.step('winner-leads-broken-prince', {
    description: 'The trick winner leads again and may now lead Princes',
    verifications: [
      { spec: 'Alex has captured two complete tricks', check: async () => expect(page.getByLabel('Alex captured cards')).toHaveText('6') },
      { spec: 'Prince 4 is enabled after the suit was broken', check: async () => expect(page.getByRole('button', { name: 'Princes 4', exact: true })).toBeEnabled() },
      { spec: 'The fourth trick is ready for the previous winner', check: async () => expect(page.getByRole('alert')).toContainText('Trick 4') }
    ]
  });

  await play(page, 'Princes 4');
  await play(jo, 'Princes 2');
  await play(sam, 'Princes 9');
  await expect(sam.getByRole('alert')).toContainText('Your turn');
  await joContext.close();
  await samContext.close();
  steps.generateDocs();
});
