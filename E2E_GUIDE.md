# E2E testing guide

Playwright end-to-end scenarios are the primary source of truth for every
user-visible Rebel Princess flow. Tests exercise the built application against
local Firebase Auth and Firestore emulators; they must never use production
Firebase data or credentials.

This guide establishes the required testing contract before the game is
implemented. The eventual Playwright configuration, helper, specs, CI job, and
package scripts must enforce it rather than merely relying on convention.

## Absolute rules

- **Zero-pixel tolerance.** Every documented visual step uses
  `toHaveScreenshot` with `maxDiffPixels: 0`. A single changed pixel fails.
- **No arbitrary timeouts.** Never call `page.waitForTimeout()`, `setTimeout()`,
  or implement a sleep or manual polling loop.
- **No explicit timeout overrides.** Actions and assertions rely on Playwright
  auto-waiting and observable state. Do not add `{ timeout: ... }` to make a test
  pass. Configure a global action and expectation ceiling of 2,000 ms. The
  suite-wide test execution budget is only a runaway-process guard and may be
  long enough for a complete production-size game; it is never a synchronization
  mechanism or permission to wait for elapsed time.
- **No retries.** Configure `retries: 0`; every scenario passes on its first run.
- **No screenshot masking.** Never use `mask`, nonzero pixel tolerances, or
  ignored regions to conceal nondeterminism.
- **No manual screenshots.** Never call `page.screenshot()` or manually name,
  number, or document captures.
- **No ignored tests.** Do not commit `test.skip`, `test.fixme`, focused tests,
  conditional CI skips, or quarantined failures.

An infrastructure-only startup limit for the dev server and Firebase emulators
is permitted. It is not a substitute for an action or assertion timeout and
must not hide application synchronization bugs.

## Unified test-step helper

Keep the established shared `TestStepHelper` API and responsibilities generic;
do not fork it with Rebel Princess behavior. This implementation intentionally
removes the legacy helper's explicit 5–30 second timeout overrides so it obeys
this guide's stricter global two-second contract. Improvements that apply to
sibling projects should be propagated back to their shared helpers.

Every stable user-visible state is verified and captured atomically through
`TestStepHelper.step()`. The helper is responsible for:

1. running semantic verifications;
2. waiting for observable synchronization and finite animations;
3. moving the pointer out of the content;
4. checking viewport clipping and unintended overlap;
5. taking and comparing the zero-tolerance screenshot;
6. recording the step for the generated scenario walkthrough.

Use the unified pattern:

```ts
import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('players join a game', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Players join a game',
    'The host creates an invite and another princess joins it.'
  );

  await page.goto('/?gameId=e2e-001&seed=123456789');
  await steps.step('host-ready', {
    description: 'The host is ready to invite players',
    verifications: [
      {
        spec: 'The invite control displays the deterministic game ID',
        check: async () => {
          await expect(page.getByText('e2e-001')).toBeVisible();
        }
      }
    ]
  });

  steps.generateDocs();
});
```

Call `generateDocs()` after the final step. A semantic assertion is required for
every screenshot; image comparison alone is not a behavioral test.

## Determinism

Every source of visible or protocol-level variation is fixed by the scenario:

- use a unique, stable `gameId` for each test;
- use fixed Auth UIDs or deterministic emulator identities for every context;
- use a fixed shuffle seed and versioned shuffle/reducer implementation;
- use fixed player names, seats, Princesses, Round cards, deals, and actions;
- fix locale to `en-CA`, timezone to `America/Toronto`, viewport dimensions,
  device scale factor, clock, and any displayed build identifier;
- block service workers and external network requests;
- disable CSS transitions, finite animations during capture, caret blinking,
  font variation, GPU rendering, and other nondeterministic rendering;
- use locally bundled, pinned fonts and assets—never network-hosted fonts;
- seed Firestore only through the emulator or through normal client events.

Do not repair nondeterminism with masks or looser screenshots. Remove its source.

## Waiting and synchronization

Wait for facts a user or protocol observer can see: an accessible element is
visible or enabled, the URL changes, a Firestore-backed sync indicator reaches
its settled state, or another client renders the expected event. Prefer locators
and Playwright assertions, which auto-wait.

Do not wait for elapsed time. Do not inspect emulator internals merely to guess
that the UI should be ready. When no observable state exists, add an accessible,
deterministic state indicator to the application and assert against it.

Suite setup obeys the same rule: it opens the real client and waits for the
visible deterministic build marker and `Firebase emulator ready` status. This
warms the Vite transform pipeline while proving that the rendered app—not merely
an open development-server port—is ready before the first scenario runs.

## Multiplayer scenarios

Use one isolated browser context per player so anonymous Auth persistence and
local UI state cannot leak between players. All contexts subscribe to the same
emulated append-only game stream. A multiplayer step should assert both sides of
an action—for example, the actor's hand changes and every other client displays
the played card—before capturing each relevant viewport.

Because all hand data is intentionally readable, tests verify presentation, not
secrecy: each trustworthy client displays only its own hand even though the full
event stream is available locally. Do not add server-side privacy expectations.

Cover at least these flows once gameplay exists:

- anonymous authentication, game creation, joining, seating, and readiness;
- deterministic setup, shuffle, deal, and card pass in both directions;
- follow-suit legality, void play, breaking Princes, and trick resolution;
- each implemented Princess power and Round card override;
- proposal scoring, Frog scoring, tie-breaking, and the five-round result;
- reload/reconnect and replay from the complete event stream;
- duplicate or concurrent event handling and reducer-version mismatch;
- mobile portrait, mobile landscape, tablet, and desktop layouts.

## Viewports and rendering

Critical controls, cards, hands, scores, and status must fit without clipping or
unintended overlap. Run the shared `checkNoClippingOrOverlap` verification from
the step helper before capture. Test explicit viewport projects for mobile
portrait, mobile landscape, tablet, and desktop rather than resizing within a
scenario.

Chromium must use software rendering, device scale factor 1, reduced motion, and
the deterministic font/rendering flags established by the sibling projects.
Commit the configuration with `maxDiffPixels: 0`—not merely a zero ratio.

## Scenario layout

Each numbered scenario owns its spec, generated walkthrough, and committed
baseline images:

```text
tests/e2e/
  helpers/
    test-step-helper.ts
  001-room-flow/
    001-room-flow.spec.ts
    README.md
    screenshots/
      000-host-ready.png
```

Never hand-edit generated scenario `README.md` files or manually manage
screenshot counters. Review every regenerated walkthrough and baseline image.

## Commands

Once the application and Playwright harness exist, expose these scripts and run
them only inside the Nix development shell:

```sh
nix develop --command bun run test:e2e
nix develop --command bun run test:e2e:update-snapshots
```

Updating snapshots is an intentional review operation, not a way to make a
failing test green. After inspecting every changed image, rerun the ordinary E2E
command without snapshot updates and require it to pass.
