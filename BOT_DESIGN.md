# Bot-player and learning-system design

**Status:** Basic playable RL bot implemented; stronger-bot phases remain proposed

**Goal:** Add useful bot players soon, while building the infrastructure needed
to train strong policies for every Princess and Round-card context.

## Implementation status

The first playable learned-bot increment is implemented:

- versioned `BotAction`, `BotObservation`, `BotPolicy`, and `BotDecision`
  contracts;
- a seat-scoped observation builder that redacts opponent hands, passes,
  private power inspections, and face-down Masquerade plays;
- reducer-backed legal action enumeration for setup, passing, ordinary play,
  mandatory Princess responses, before-trick priority, and stateful Round
  actions;
- logical-action to game-event adaptation for the existing event types;
- seeded random-legal policy and a headless ordinary-Round runner with card
  conservation, uniqueness, legality, termination, and replay tests.
- a reproducible policy-gradient trainer and checked-in linear policy trained
  for 2,000 seeded self-play rounds across three to six players;
- a live controller that gives every bot a separate anonymous Firebase identity,
  performs sealed Princess and Crystal Clear choices, and appends normal game
  events through the same reducer used by people;
- a host-scoped controller registry, persistent isolated Auth sessions, and
  replayed controller claims that restore both current and legacy bot seats
  after the host reloads;
- an **Add RL bot** host control and zero-tolerance browser coverage in which one
  human and two bots join, ready, pass, survive a host reload, and complete a
  trick.

This is deliberately a basic RL policy, not a claim of strong play. Its learned
features cover passing and trick play, while setup and unusual mandatory actions
are legal-mask-driven and often conservative (for example, declining optional
before-trick powers and Haggle). The creating host's browser owns the bot
registry and automatically reconstructs its controllers after reload. Closing
every host tab pauses them until that host returns. Complete-game headless
simulation, optional Princess strategy, removal/difficulty controls, an
incremental engine, and benchmark-based strength promotion remain future work.

## Decision summary

Build the bot system in layers:

1. Extract a canonical, pure game interface that can enumerate legal actions,
   apply one action, and return a seat-scoped observation without exposing hidden
   information.
2. Ship a random-legal bot as an engine and integration test, followed by a
   modular heuristic bot that is competent enough for ordinary games.
3. Add information-set Monte Carlo search on top of the heuristic policy. Use it
   both as a stronger bot and as a source of training targets.
4. Train one conditional policy/value model across all Princesses, Round cards,
   player counts, and phases before considering separate models.
5. Specialize only where evaluation demonstrates a benefit, using factorized
   Princess, Round, and optional Princess×Round adapters rather than maintaining
   312 unrelated policies.

Firestore remains the live-game event transport. Training and large-scale
self-play use an in-memory simulator and must not create Firebase rooms.

## Why this order

Reinforcement learning is not the first dependency. A trainable environment
first needs to answer four questions exactly and quickly:

- What may this seat legally do now?
- What is this seat allowed to observe?
- What state results from a chosen action?
- How good was the eventual outcome?

The current event-sourced reducer already contains most game semantics, but it
derives a projection from a complete event history and the UI still constructs
some choices directly. Training against UI controls or Firestore would be slow,
hard to reproduce, and likely to create a second, subtly different rule engine.

A random-legal bot proves the action boundary. A heuristic bot makes the product
useful and supplies rollout behavior. Search exposes weaknesses in those
heuristics and produces better targets. RL then improves a stable environment
instead of learning around engine defects.

## Non-goals for the first bot increment

- Training a neural model in the browser.
- Giving a bot access to opponents' private cards because Firestore happens to
  contain them.
- Creating a separate hard-coded bot for every Princess and Round combination.
- Using wall-clock delays as part of bot logic or training.
- Moving game authority to a server or changing the trusted-client security
  model.
- Guaranteeing optimal play. Rebel Princess has hidden information,
  simultaneous choices, multiplayer incentives, and a large contextual ruleset.

## Architectural boundaries

```text
live UI / headless tournament / trainer
                 |
           BotController
                 |
              Policy
     heuristic / search / learned
                 |
    observation + legal-action API
                 |
       pure simulator / reducer
                 |
      versioned game definitions
```

### 1. Canonical game engine

There must be one source of truth for legality and transitions. Initially, the
simulator may append a synthetic event and call the existing reducer. That is
correct but will become too slow for search and self-play because every step
replays the full history. Once the contract is covered by differential tests,
the reducer should be refactored around an incremental immutable state transition:

```ts
type EngineState = { /* complete authoritative state */ };

function initialState(config: GameConfig): EngineState;
function legalActions(state: EngineState, seatId: string): BotAction[];
function applyAction(state: EngineState, action: BotAction): EngineState;
function isTerminal(state: EngineState): boolean;
```

The Firestore projection must be derived from the same transition functions.
The browser, search bot, and trainer must not each reimplement follow-suit,
Princess timing, Round rules, scoring, or before-trick priority.

Every transition is deterministic. Random effects—deals, inspected cards, and
any future shuffles—take an explicit seed or RNG state. A simulation must be
reproducible from its configuration and action list.

### 2. Typed action space

`BotAction` should be a discriminated union that represents user intent rather
than DOM operations. It needs to cover every decision point, including:

- selecting and revealing a Princess;
- passing, retracting, and confirming cards;
- raising or lowering a hand for the next before-trick window;
- activating or declining a Princess power;
- choosing a player, suit, card, or ordered redistribution for a power;
- playing a legal card;
- resolving Mulan and Alice;
- all Round-specific choices such as set-aside, Crystal Clear, After Party,
  Wedding Gift, Musical Chairs, and Haggle with the Hag;
- dealing the next round or rematching when a bot is allowed to host.

Actions should use stable card IDs or `{suit, rank}` values and logical seat IDs.
They must never contain locators, display labels, or Firebase document IDs.

Variable action counts are expected. Policies receive the complete candidate
list and return an index into that list. Learned policies use an action mask so
an illegal action has exactly zero selection probability.

### 3. Fair observations

`BotObservation` is constructed for one seat and is the only input a policy may
receive. It contains:

- the bot's hand and Princess;
- public seating, scores, Round cards, current Round, trick, captures, and turn;
- publicly exhausted powers and active modifiers;
- the bot's private inspected or committed choice when applicable;
- visible action ownership, before-trick signals, and priority state;
- a compact, deterministic action history or derived public-history features.

It must hide:

- opponents' hands and unrevealed passes;
- face-down Masquerade cards until the trick reveals;
- sealed Princess and Crystal Clear choices before collective reveal;
- private Ice Princess or Scheherazade inspection results from other seats;
- any other value that the trustworthy UI would not display to that seat.

This boundary is essential because the shared Firestore stream deliberately
contains complete hands. A policy that reads `GameProjection` directly would be
a cheating perfect-information bot.

Add an automated information-barrier test for every hidden field. A deliberately
instrumented policy should be unable to distinguish two authoritative states
that produce the same observation for its seat.

### 4. Policy and controller

Policies are pure decision functions:

```ts
interface BotPolicy {
  readonly id: string;
  choose(
    observation: BotObservation,
    legalActions: readonly BotAction[],
    random: SeededRandom
  ): BotDecision | Promise<BotDecision>;
}
```

`BotDecision` records the selected index plus optional diagnostics such as
candidate scores, search visits, model version, and decision seed. Diagnostics
are not canonical game events.

`BotController` owns transport concerns. It watches a projection, decides
whether its seat currently owes an action, obtains the fair observation and
legal actions, asks the policy once, and appends the corresponding event. It
uses a stable decision key derived from game, round, phase, trick, and event
cursor so reconnects cannot submit the same decision twice.

Human and bot actions should ultimately pass through the same action-to-event
adapter. This makes the legal-action API testable against the controls shown to
human players.

## Live bot identities

The existing Firestore rule requires an event's `actorUid` to equal the signed-in
Firebase UID, and hands and turns are keyed by that UID. Do not make all bots
impersonate the host.

Each bot gets a separate anonymous Firebase Auth session created by a named
Firebase app with IndexedDB persistence. The host's browser records the named
controller and sealed-choice nonces, then reconstructs the controller after a
reload. If an older bot has no persistent credentials, the host appends a
replayed controller claim that maps a new authenticated controller UID onto the
existing bot seat. Every write remains attributable to the Firebase identity
that actually submitted it.

Initial product behavior:

- the host may add or remove bots only while the room is open;
- each bot has a generated name and selectable difficulty;
- bot Princess choice and ready state use the normal event flow;
- a bot acts immediately after the required observable state arrives;
- a small deterministic presentation delay may be added by the UI later, but
  never by the policy, simulator, tests, or training environment;
- if the host tab closes, bot decisions pause; reopening the room as that host
  resumes them from the canonical event prefix;
- controller ownership does not yet migrate to another human or device.

If browser-managed Auth sessions prove fragile, a headless bot service can use
the same controller and policy interfaces. That is an operational change, not a
reason to fork game logic.

## Baseline policies

### Random-legal policy

Choose uniformly from `legalActions`. This policy is intentionally weak, but it
is valuable because it:

- proves that every reachable decision exposes at least one legal action;
- exercises every multi-step phase without UI automation;
- provides a floor for evaluation;
- detects illegal-action and non-termination bugs during fuzzed self-play.

Run thousands of seeded games with 3–6 random bots. Every game must terminate,
conserve cards, preserve event/replay equivalence, and produce valid scores.

### Modular heuristic policy

Score each legal action with named, inspectable features. Avoid one large nest
of Princess×Round conditionals. Use modules for phases and contextual deltas:

| Phase | Initial considerations |
|---|---|
| Princess choice | synergy with the five known Round cards; flexibility; player count |
| Passing | shed dangerous Princes/Frog; create voids; retain control cards; Round-specific card value |
| Lead | avoid taking penalty-rich tricks; control future suit access; exploit known voids |
| Follow | follow suit legally; minimize expected trick cost; decide when winning is strategically useful |
| Before-trick signal | expected value of keeping the option open versus revealing intent and decision cost |
| Princess power | timing, remaining cards, target value, interaction with already-resolved powers |
| Round action | explicit rule objectives such as reserves, gifts, split hands, reveals, and swaps |
| Endgame | exact remaining-card and score calculations when the uncertainty is small |

Use a factorized score:

```text
score(action) =
  global features
  + phase features
  + Princess delta
  + Round delta
  + optional Princess×Round interaction delta
```

Weights live in versioned data, not scattered constants. The first weights can
be hand-authored. Later they can be tuned by tournament search (for example
CMA-ES or population-based mutation) without changing policy code.

Use seeded random tie-breaking so repeated simulations are reproducible but
bots do not become trivially predictable.

## Search-based bot

Ordinary minimax is inappropriate because opponents' hands are hidden and the
game has three to six independently scoring players. Use information-set Monte
Carlo tree search (ISMCTS) or determinized Monte Carlo search:

1. Sample opponent hands consistent with the bot's observation and public
   history.
2. Search legal actions in each sampled state.
3. Use the heuristic policy for rollout actions and leaf evaluation.
4. Aggregate action values across determinizations.
5. Select by visit count or expected value within a fixed simulation budget.

The sampler must respect known voids, revealed cards, passes visible to the bot,
reserved-card constraints, and all public captures. It must not copy the actual
hidden hands from `EngineState`.

A perfect-information search policy is useful only as an offline oracle and
upper-bound diagnostic. It must be named clearly, excluded from normal live bot
selection, and covered by a test that prevents accidental use in fair matches.

Search budgets define early difficulty levels:

- **Easy:** heuristic policy with more exploration.
- **Standard:** deterministic heuristic policy.
- **Strong:** heuristic policy plus a modest ISMCTS budget.
- **Analysis:** larger offline search, not intended for interactive latency.

## Training path

### Dataset generation

Record compact transitions from seeded headless games:

```text
engine version
policy versions and seat assignment
game configuration and seed
seat-scoped observation
legal-action encoding and mask
chosen action
search visit distribution, when available
round and terminal outcomes
```

Do not train directly from raw Firestore documents. Convert event logs through
the versioned engine and observation builder so old games can be replayed and
filtered consistently.

Store large generated datasets and model binaries outside Git. Commit manifests,
schemas, small golden fixtures, checksums, and reproducible generation commands.

### Behavior cloning

Train a conditional policy to imitate the strong search bot. This supplies a
reasonable initialization, dramatically reduces random exploration, and tests
the full observation/action encoding before introducing RL.

The first learned model should be one generalist conditioned on:

- Princess ID;
- Round ID and the ordered five-Round game context;
- player count and relative seat positions;
- phase/decision type;
- hand, trick, captures, public history, scores, and power state.

A card/set encoder or small Transformer is preferable to a fixed flat vector:
hands and action lists are variable-sized, and seat order should be represented
relatively. The policy head scores each provided legal action; the value head
predicts the acting seat's expected final result.

Export a browser-consumable model only after the headless model passes parity
tests. ONNX Runtime Web is a reasonable initial deployment target, but the model
format should stay behind `BotPolicy` so it can be changed.

### Reinforcement learning

Fine-tune by population self-play with legal-action masking. Masked PPO is a
practical first algorithm because the environment has variable discrete
actions and multiple decision phases. An AlphaZero-style policy/value loop can
be evaluated later once ISMCTS and batched inference are efficient.

Use a league rather than only the newest policy playing itself:

- heuristic and search baselines never leave the league;
- keep several historical learned checkpoints;
- randomize seats, player counts, Princesses, Round sets, deals, and opponent
  mixtures;
- periodically add exploiters trained against dominant league policies;
- promote a checkpoint only after it clears fixed regression tournaments.

### Reward

The true objective is the terminal game result. Start with:

```text
terminal utility = mean(opponents' final scores) - own final score
```

Normalize by player count and expected score range. Track win/share-of-win and
rank separately; do not replace score differential with a sparse win reward.

Round-end score differential may be used as potential-based shaping whose sum
telescopes to the terminal objective. Avoid arbitrary rewards for shedding a
Prince, winning a trick, using a Princess, or raising a hand: those shortcuts
are context-dependent and can teach visibly bad play.

## Princess and Round specialization

There are 12 Princesses and 26 Round cards, or 312 pairs before player count,
seat, hand, and multi-Round context are considered. Training 312 independent
models from the start would fragment data and make comparison and deployment
difficult.

Use progressive specialization:

1. **Generalist:** one model conditioned on Princess and Round IDs.
2. **Factorized adapters:** shared trunk plus learned Princess and Round
   embeddings or small residual heads.
3. **Interaction adapter:** add a small Princess×Round delta only for pairs with
   enough data and a measured generalist weakness.
4. **Independent specialist:** reserve for rare combinations whose improvement
   justifies separate training and artifact management.

Model manifests map a context to its policy components:

```json
{
  "engineVersion": 1,
  "observationVersion": 1,
  "actionVersion": 1,
  "baseModel": "generalist-v7",
  "princessAdapters": { "mulan": "mulan-v3" },
  "roundAdapters": { "crystal-clear": "crystal-clear-v2" },
  "combinationAdapters": {
    "sleeping-beauty+after-party": "sb-after-party-v1"
  }
}
```

If no specialist is present, resolution falls back to the generalist. Every
artifact declares compatible engine, observation, and action versions.

## Evaluation

### Fixed benchmark matrix

Maintain deterministic benchmark seeds covering:

- 3, 4, 5, and 6 players;
- every Princess in each seat position;
- every Round card as the active Round;
- all before-, during-, and after-trick decision paths;
- important Princess×Round interactions and known edge cases;
- complete five-Round games, not only isolated tricks;
- reconnect/replay at multi-step power boundaries.

Full 12×26 coverage should exist in evaluation even if most combinations share
one model.

### Metrics

- average final score differential;
- win rate, shared-win credit, and average rank;
- performance by Princess, Round, pair, player count, and seat;
- illegal-action rate (must be zero);
- non-termination and maximum decision-count rate (must be zero);
- decision latency and search nodes per second;
- model size and browser memory;
- calibration of the value estimate;
- diversity and deterministic repeatability under recorded seeds.

Report confidence intervals and paired results on identical deals. A candidate
is not stronger merely because it played different random games.

### Promotion gates

A new policy may become the default only when it:

- never chooses outside the supplied legal-action mask;
- completes the deterministic regression corpus;
- beats or matches the current default with statistical confidence overall;
- has no material regression in any Princess, Round, or player-count slice;
- passes observation-barrier tests;
- meets the interactive latency and artifact-size budget;
- can reproduce every benchmark decision from its manifest and seed.

## Testing strategy

### Engine properties

Use seeded property tests and random-legal games to prove:

- cards are conserved and unique;
- every nonterminal acting seat has at least one legal action;
- applying a legal action never creates an invalid projection;
- illegal actions are rejected without mutating state;
- every game terminates within a defensible decision bound;
- replay from actions/events matches incremental state exactly;
- scores and winner selection match the existing reducer;
- before-trick priority cannot overlap ordinary card play;
- simultaneous and sealed choices reveal no early information.

### Differential tests

For a shared corpus of event streams:

1. derive the current Firestore projection;
2. replay equivalent actions through the simulator;
3. compare all authoritative fields and public observations.

Keep these tests while refactoring for speed. They prevent the training engine
from drifting away from the shipped game.

### Product tests

End-to-end tests should add a bot through the room UI and verify a complete game
against human-controlled seats. They should assert observable state, event
attribution, reconnect behavior, and exact screenshots. Large self-play and
strength evaluation belong in headless tests, not Playwright.

## Versioning and reproducibility

Version these independently:

- event schema and reducer;
- incremental engine state;
- observation schema;
- action encoding;
- heuristic weights;
- search configuration;
- model architecture and weights;
- benchmark corpus.

Every bot-authored event should be explainable from a decision record containing
policy ID, model/weight version, observation hash, legal-action hash, action
index, and seed. The decision record may be local telemetry or a training log;
do not bloat the canonical game stream with model internals.

## Implementation plan

### Phase 0 — Freeze contracts and golden games

Deliver:

- `BotAction`, `BotObservation`, `BotPolicy`, and `BotDecision` type designs;
- golden event streams for representative Princess and Round interactions;
- explicit hidden-information rules for each event and UI state;
- engine/observation/action version constants.

Exit criteria: every current decision type is listed and every hidden field has
an owner and reveal condition.

### Phase 1 — Legal-action API and simulator shell

Deliver:

- `legalActions` for setup, passing, ordinary play, Princess powers,
  before-trick priority, and every Round action;
- action-to-event conversion using the current reducer;
- seat-scoped observation builder;
- random-legal policy and seeded headless match runner;
- information-barrier, conservation, termination, and replay-equivalence tests.

Exit criteria: thousands of random 3–6 player games terminate with zero illegal
actions or invariant failures.

### Phase 2 — Live heuristic bot MVP

Deliver:

- browser `BotController` with a distinct anonymous Auth identity per bot;
- host controls to add/remove bots and choose Easy/Standard difficulty;
- modular pass, lead, follow, Princess, and Round heuristics;
- stable decision keys and reconnect-safe duplicate prevention;
- one complete mixed human/bot game in E2E.

Exit criteria: bots can finish every supported Princess and Round flow without
special UI automation or human rescue.

### Phase 3 — Fast incremental engine and evaluator

Deliver:

- immutable incremental transitions shared with the production reducer;
- batched/vectorized headless simulation workers;
- benchmark corpus, tournament runner, reports, and paired confidence intervals;
- versioned heuristic weights and automated weight tuning.

Exit criteria: simulator/reducer differential tests are exact, and self-play is
fast enough for search and dataset generation.

### Phase 4 — Fair search bot

Deliver:

- hidden-hand determinization consistent with public history;
- ISMCTS using heuristic rollouts;
- fixed live and offline search budgets;
- perfect-information oracle isolated to evaluation;
- search diagnostics and benchmark comparison.

Exit criteria: the Strong bot reliably improves over Standard without hidden
information leakage or unacceptable interactive latency.

### Phase 5 — Imitation model

Deliver:

- versioned transition dataset format and generator;
- observation and legal-action encoders;
- conditional policy/value network;
- search-target behavior cloning;
- model export and TypeScript inference parity tests.

Exit criteria: the cloned policy reproduces held-out search choices well enough
to beat the heuristic baseline and runs within the browser budget.

### Phase 6 — Self-play RL and league

Deliver:

- masked PPO training loop;
- population league with historical checkpoints and fixed baselines;
- reproducible checkpoint manifests;
- automated evaluation and promotion reports.

Exit criteria: a learned generalist clears all safety gates and improves paired
score differential across the benchmark matrix.

### Phase 7 — Targeted specialization

Deliver:

- Princess and Round adapters;
- slice reports identifying weak combinations;
- optional pair adapters selected by evidence;
- manifest-based policy resolution and generalist fallback.

Exit criteria: each retained specialist produces a statistically meaningful
gain without degrading unrelated contexts or making deployment unmanageable.

### Phase 8 — Production hardening

Deliver:

- transferable bot-controller ownership across people or devices;
- model caching, integrity checks, rollback, and compatibility handling;
- opt-in anonymized decision telemetry;
- continuous benchmark and replay regression jobs;
- accessible explanations such as “played low to avoid the Frog” for heuristic
  and search policies where the evidence is reliable.

Exit criteria: live bots recover predictably, artifacts are reproducible and
rollback-safe, and model upgrades cannot silently change old replay semantics.

## Recommended next change

Turn the basic playable policy into a measurable full-game baseline:

1. extend the headless runner through all five rounds, every Round action, and
   optional Princess activation rather than relying on live integration for
   those paths;
2. add deterministic benchmark deals and paired trained-policy versus
   random/heuristic reports before making any strength claim;
3. add explicit heuristic modules for optional Princess timing and the actions
   the MVP intentionally declines;
4. add bot removal, difficulty selection, and controller migration to another
   human or device;
5. refactor replay-on-every-step into the incremental engine before scaling
   beyond the small linear trainer.

The checked-in linear model is small enough to audit and proves the complete
training-to-browser path. A neural model or search policy should replace it only
after the full-game benchmark and fairness boundaries are equally reproducible.
