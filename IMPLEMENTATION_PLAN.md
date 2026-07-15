# Rebel Princess implementation plan

## Objective

Build the complete browser game as a sequence of independently playable vertical
slices. Every implementation commit must be a tracer bullet: it begins at a
real browser entry point, crosses the real client, reducer, Firebase emulator,
and rendering layers, and finishes with a user-visible result verified by a new
or extended Playwright scenario.

This planning commit is intentionally documentation-only. After it, a commit is
not complete unless its behavior can be exercised start to finish and its E2E
scenario passes alone and in the full suite.

## Non-negotiable commit contract

Each implementation commit must contain all of the following in one reviewable
unit:

1. the smallest coherent user-facing capability;
2. any event schema and deterministic reducer changes required by it;
3. Firebase Security Rules and emulator test changes required by it;
4. accessible UI for the capability at every affected viewport;
5. a tracer-bullet E2E step or scenario using the real UI and emulators;
6. zero-pixel screenshot baselines and the generated scenario walkthrough;
7. unit tests for pure rules or reducer edge cases that are impractical to show
   exhaustively in E2E, without replacing the E2E tracer;
8. documentation updates for any changed protocol or invariant.

Never land a commit that introduces only an unused layer (for example, a reducer
with no UI), implements UI against mock state, or defers its E2E coverage to a
later commit. Refactoring commits must preserve the complete E2E suite; when a
refactor changes observable structure or behavior, it needs its own tracer step.

Before each commit and again before each push, Husky runs
`scripts/verify-change.sh`. The repository-managed hooks are installed by the
`prepare` package script. The verifier enters `nix develop` when necessary and
runs the following checks; do not bypass it with `--no-verify`:

```sh
nix develop --command bun run check
nix develop --command bun run test:unit
nix develop --command bun run test:rules
nix develop --command bun run test:e2e -- <changed-scenario>
nix develop --command bun run test:e2e
nix develop --command bun run build
git diff --check
```

Before the application is scaffolded, the verifier runs patch checks and the
Firestore Rules emulator check. The first slice creates `src/` and all remaining
package scripts atomically; once `src/` exists, the verifier treats any missing
script as an error and runs the full suite. Follow `E2E_GUIDE.md` throughout: no
sleeps, explicit test timeout overrides, retries, masks, manual screenshots,
ignored tests, or nonzero screenshot tolerances.

## Fixed technical decisions

- SvelteKit with `@sveltejs/adapter-static`, TypeScript, and Bun.
- Firebase anonymous Auth and Cloud Firestore browser SDK.
- Canonical state is one readable append-only stream at
  `games/{gameId}/events/{eventId}`.
- All clients can read all hands. Trustworthy clients enforce legal interaction
  and selectively display information; the backend does not prevent cheating.
- Every event has `type`, `actorUid`, `clientSeq`, `createdAt`, `schemaVersion`,
  and `reducerVersion`. Events cannot be updated or deleted.
- Game state is a deterministic projection of ordered events. The document ID
  breaks equal-server-timestamp ties.
- Shuffle and random choices use a committed seed plus a versioned PRNG.
- Persisted events contain stable IDs and values, never localized display text.
- Generated atlases provide illustration only. Values, names, suits, powers,
  and rules are accessible HTML text mapped through `assets/manifest.json`.

## E2E scenario map

Numbered scenarios own their spec, generated `README.md`, and screenshots. Extend
an existing scenario when the new behavior naturally continues its story;
otherwise add the next scenario number.

```text
001-app-shell-and-deployment
002-create-and-join-game
003-setup-and-deal
004-card-pass
005-trick-taking
006-round-scoring
007-five-round-game
008-princess-powers-basic
009-princess-powers-interactive
010-round-rules-introductory
011-round-rules-scoring
012-round-rules-trick-order
013-round-rules-hand-manipulation
014-reconnect-and-conflicts
015-responsive-complete-game
```

Multiplayer scenarios use one isolated browser context per player and the real
Firestore emulator stream. Each action is asserted from the actor's view and at
least one observer's view before screenshots are taken.

## Implementation sequence

Every numbered item below is intended to end in at least one commit satisfying
the commit contract. If an item becomes too large for one reviewable commit,
split it into smaller tracer bullets; never split implementation from its E2E
proof.

### 1. Application shell, E2E harness, CI, and deploy preview

- Scaffold SvelteKit static output, Firebase SDK initialization, CSS reset,
  local fonts, atlas loading, and an accessible landing page.
- Add Vitest, Playwright, Firebase emulator startup, the shared
  `TestStepHelper` API without legacy timeout overrides, deterministic Chromium
  flags, and zero-pixel configuration.
- Add `001-app-shell-and-deployment`: load through the emulator-backed dev
  server, verify the title/build marker and Firebase readiness, capture phone
  and desktop baselines, and generate its walkthrough.
- Add CI and the GitHub Pages deployment workflow described below. The tracer
  finishes at the PR preview URL, not merely at a local build artifact.

### 2. Anonymous identity and append-only game creation

- Sign in anonymously and expose deterministic emulator identities in E2E mode.
- Implement the Firestore event repository, ordering/cursor rules, subscription,
  idempotent local append, reducer envelope validation, and replay cache key.
- Open production rules only enough for authenticated full-stream reads and
  own-UID immutable event creates; keep all other paths denied.
- Add `002-create-and-join-game`: host creates a stable invite, a second context
  joins, both derive the same membership projection, and reload preserves it.

### 3. Setup, seats, Princess choice, and deterministic deal

- Support 3–6 seats, player names, ready state, two dealt Princess options per
  player with one game-long selection,
  five Round-card selection, player-count deck composition, seeded shuffle, and
  deal events.
- Render the local hand from the suit atlas and opponents as counts; verify in
  E2E that the full stream contains all hands while each trustworthy client only
  shows its own.
- Add `003-setup-and-deal` with a fixed three-player seed and exact expected
  hands, seats, Princesses, Round cards, and responsive screenshots.

### 4. Simultaneous card passing

- Implement left, right, and split pass instructions without revealing incoming
  cards before every player submits.
- Resolve submitted passes deterministically into new hands.
- Add `004-card-pass`: all contexts select cards, early submitters remain
  blocked, resolution updates every exact hand, and no card is lost or duplicated.

### 5. Base trick-taking loop

- Implement leader selection, clockwise turns, follow-suit legality, void plays,
  trick winner calculation, captured piles, and next-trick leadership.
- Implement the Prince lead restriction, breaking Princes, the Frog exception,
  and the only-Princes exception.
- Add `005-trick-taking`, driving multiple browsers through fixed tricks that
  exercise legal/illegal controls, observer synchronization, Prince breaking,
  and exact winner projections.

### 6. Round scoring and transition

- Score each Prince as one proposal and Pet 8/Frog as five.
- Hide captured-card contents during the round, reveal the scoring breakdown at
  its end, update totals, refresh Princess powers, redeal, reveal the next Round
  card, and make the lowest cumulative scorer the next leader. Resolve a tie by
  scanning clockwise beginning after the previous round leader.
- Add `006-round-scoring` from the final live trick through the next round's
  first playable hand.

### 7. Complete five-round base game

- Complete game lifecycle, terminal projection, lowest-score victory, zero-round
  tie-break, shared victory, rematch/new-game controls, and immutable summary.
- Add `007-five-round-game` using complete production-size deterministic deals.
  Three real clients pass and legally play all 180 cards through the UI and
  Firestore stream, validate every exact round and cumulative score, resolve
  the final result, and enter a rematch without bypassing any action.

### 8. Princess powers: direct card/trick modifiers

- Implement and unit-test Snow White, Cinderella, Pocahontas, Mulan, and the Pea
  Princess, including exhaustion and precedence over Round/base rules.
- Add or extend `008-princess-powers-basic` so every power is activated through
  the UI and its effect is visible to all clients.

### 9. Princess powers: interactive hand/turn modifiers

- Implement and unit-test the Little Mermaid, Sleeping Beauty, Alice,
  Scheherazade, and the Ice Princess, including secret-choice presentation from
  the shared readable stream.
- Add `009-princess-powers-interactive` with deterministic selections and
  observer-visible resolution for every power.

### 10. Introductory Round cards

- Implement Once Upon a Time, Invitation, Masquerade Ball, Royal Decree,
  Musical Chairs, Pets' Revenge, and Late to the Ball.
- Add `010-round-rules-introductory`, covering each rule from reveal through a
  consequential trick or scoring result.

### 11. Scoring and rank Round cards

- Implement Poisoned Apple, Crystal Clear, Upside Down, Dancing Queens,
  Bathroom Break, and Single Fairy.
- Add `011-round-rules-scoring` with semantic assertions for every changed
  winner, public reveal, positive score, and negative score.

### 12. Trick-order Round cards

- Implement The Prince Always Rings Twice, Midnight Makeover, Odds and Evens,
  and Pass the Bouquet.
- Add `012-round-rules-trick-order` with exact legal-choice sets and winners.

### 13. Hand-manipulation Round cards

- Implement Wedding Gift, After-party, Blind Man's Bluff, and Haggle with the
  Hag, including odd interaction/Princess precedence cases.
- Add `013-round-rules-hand-manipulation` from setup through resolved hands and
  captured piles for every rule.

### 14. Replay, reconnect, conflicts, and versioning

- Rehydrate from cache plus cursor, replay from scratch, handle duplicate local
  submissions, deterministically resolve concurrent/stale events, and present a
  clear incompatible reducer/schema state.
- Add `014-reconnect-and-conflicts`: disconnect a context, advance the game,
  reconnect/replay, attempt duplicates and conflicting actions, then verify all
  trustworthy clients converge.

### 15. Complete responsive and accessibility pass

- Finish keyboard and touch interaction, focus order, live announcements,
  contrast, reduced motion, safe areas, reconnection affordances, and installable
  static-site metadata.
- Add `015-responsive-complete-game` across mobile portrait, mobile landscape,
  tablet, and desktop, using clipping/overlap checks at every visual step.
- Audit all earlier baselines; changes are accepted only when semantically
  justified and rerun without snapshot-update mode.

## GitHub Pages PR-preview workflow

Implement `.github/workflows/ci-and-deploy.yml` in slice 1, modeled on the
sibling projects but using Bun through `nix develop`. It runs for same-repository
`pull_request` events targeting `main`, pushes to `main`, and manual dispatches.

The job sequence is:

1. checkout the exact head SHA;
2. install Nix and enter the locked development shell;
3. `bun install --frozen-lockfile` and install pinned Playwright Chromium;
4. run check, unit tests, Rules tests, and the complete E2E suite against
   Firebase emulators;
5. choose `PUBLIC_BASE_PATH=/rebelprincess/pr<PR number>` for a PR or
   `/rebelprincess` for `main`;
6. build once with the Firebase secrets and exact commit hash;
7. deploy `build/` using `peaceiris/actions-gh-pages@v4`, with `keep_files: true`
   and `destination_dir: pr<PR number>` for PRs or the branch root for `main`;
8. create or update one bot comment containing
   `https://anicolao.github.io/rebelprincess/pr<PR number>/`;
9. use concurrency group `pages-${{ github.ref }}` with cancellation so stale
   runs cannot overwrite the latest preview.

The workflow needs:

```yaml
permissions:
  contents: write
  pull-requests: write
```

GitHub Pages must publish from the root of the `gh-pages` branch. Retaining files
allows production and multiple `pr<N>/` previews to coexist. The static app must
use the computed base path for assets, client navigation, manifest URLs, and
service-worker scope. A main deployment must not delete retained PR directories;
a later maintenance workflow may remove a preview when its PR closes.

GitHub's native `actions/upload-pages-artifact`/`actions/deploy-pages` workflow is
appropriate for a single production artifact, but it replaces the deployed
site. The retained `gh-pages` branch approach is selected here specifically so
multiple PR subpath previews can coexist.

### Firebase configuration in GitHub secrets

Create these repository Actions secrets before enabling the workflow:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Populate them from the registered `Rebel Princess Web` app configuration, for
example with `gh secret set NAME`. Inject all six only into the build step's
environment; Vite intentionally bundles them into the static browser client.
Never add service-account JSON, Firebase CLI tokens, private keys, or admin SDK
credentials to the workflow or client.

Firebase documents that web configuration, including its API key, is public
identification rather than authorization. Firestore access is controlled by
Auth and Security Rules. Using GitHub secrets here provides centralized
environment configuration and log redaction; it does not make values embedded
in the deployed JavaScript confidential. Restrict the Firebase-provisioned API
key to required Firebase APIs and configure authorized domains for
`anicolao.github.io` and local emulator development.

GitHub does not expose Actions secrets to workflows from forks or Dependabot.
Therefore automatic live previews are supported only for branches in this
repository. Fork PRs still run a secret-free emulator CI build using explicit
E2E configuration, but they must not run a production-Firebase build or deploy.
Do not use `pull_request_target` to expose secrets to untrusted PR code.

References:

- GitHub Pages custom workflows:
  https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Actions secret restrictions:
  https://docs.github.com/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- Firebase API key guidance:
  https://firebase.google.com/docs/projects/api-keys

## Definition of complete

The game is complete when every rule in `RULES.md` and every selected Princess
and Round card has a deterministic reducer specification, unit edge-case tests,
and at least one real multiplayer E2E path; all fifteen scenarios pass with zero
pixel differences; production Security Rules and Rules tests agree; reload and
concurrency converge; and the exact commit is playable both at its PR preview
and at the production GitHub Pages URL after merge.
