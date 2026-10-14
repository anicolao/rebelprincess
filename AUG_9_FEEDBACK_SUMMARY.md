# August 9 playtest feedback summary

## Scope and method

**Current-state update (August 15, 2026):** this report now distinguishes the original replay findings from the fixes merged to `main` through `108a0c7`. The replay evidence below is historical and remains useful; the status and plan near the end describe what is true in the current build.

This report correlates the August 9, 2026 chat feedback with read-only replays of the two production Firestore event streams:

| Game | Local time (America/Toronto) | Players | Rounds | Result |
|---|---|---:|---|---|
| `E38C0C` | 20:07:52–20:56:33 | 5 | Single Fairy, Masquerade Ball, Arranged Marriage, Three Times a Lady, Blind Man’s Bluff | Complete, 358 events |
| `1B77D2` | 20:57:32–21:41:15 | 6 | Once Upon a Time, Three Times a Lady, Wedding Gift, Odds and Evens, Crystal Clear | Complete, 364 events |

Firestore stores UTC timestamps, so these events are dated August 10 in the database. Times in this report are converted to Toronto time.

The event collections were read without modifying production and replayed through the current `deriveGame` reducer. The UI and reducer were then inspected where an event stream alone could not explain a report. Findings use these labels:

- **Confirmed:** the replay or implementation demonstrates the issue and its cause.
- **Supported:** the implementation makes the report credible, but the visual behavior is not recorded in Firestore.
- **Not a rules bug:** the reported symptom occurred, but the replay identifies a different cause.
- **Needs reproduction:** client-only behavior that cannot be established from the stream or implementation alone.

## Executive conclusions

The playtest found three related classes of problems:

1. **Game integrity and action ordering:** Sleeping Beauty can end a round while cards are still pending, and before-trick powers do not have a proper reservation/response phase. This also explains the failed Prince lead.
2. **Hidden-choice fairness:** Princess selections and Crystal Clear reveals become visible as each player submits. The shared event projection also contains information intended to be private, so hiding it only in the UI would not provide strong secrecy.
3. **Action clarity:** legal cards, the active player, simultaneous responders, successful powers, transfers, and committed choices are not visually prominent enough. This made correct state look broken and made actual races difficult to understand.

The original build had a separate confirmed Blind Man’s Bluff rule bug: it always transferred after six tricks instead of after half of the dealt hand. Mulan’s trigger logic works independently of trick winner, but its displayed rules still omit two important conditions. Alice’s lingering highlight still has a likely concrete UI-state cause.

The highest-risk card-loss bug, both observed information leaks, Blind Man’s Bluff timing, action-owner visibility, legal-card highlighting, and responsive sizing are now fixed on `main`. The follow-on asset work also added a responsive `/assets/` review route and standardized the current card atlases.

The principal remaining architectural risk is the before-trick action window. Opening some Princess controls is still client-local, so it does not reserve the table immediately, and the reducer still permits only one pending Princess power rather than an ordered response sequence. The next work should address that shared-state race, then make submissions idempotent and finish the smaller feedback items around confirmation, receipts, copy, and persistent score access.

## Current state on `main`

| Area | Status | Current behavior and evidence |
|---|---|---|
| Sleeping Beauty final-trick completion | **Fixed** | `82bf2b1` prevents round completion while a power is pending and adds the six-contribution regression. `f8376cd` makes contribution order deterministic. |
| Princess-selection secrecy | **Fixed for normal clients** | `b00540a` commits choices before revealing them together; browser and reducer tests cover the sealed lobby flow. |
| Crystal Clear secrecy | **Fixed for normal clients** | `b00540a` uses the same commit/reveal mechanism and verifies that early submitters expose only a locked-choice receipt. |
| Blind Man’s Bluff timing | **Fixed** | `0d6ac77` derives the transfer point from the original deal size and covers the five-player, eight-card case from `E38C0C`. The center now acknowledges the transfer. |
| Active player and simultaneous action owners | **Fixed** | `8bbea7d` derives public per-seat action ownership, highlights every player who owes input, and marks completed simultaneous choices. |
| Legal-card visibility and blocked-play explanation | **Fixed** | `8bbea7d` raises legal cards with a strong gold border/glow, dims illegal cards, and explains follow-suit, forced-card, and round-rule restrictions. |
| Table, card, Princess, and text sizing | **Fixed; re-review recommended** | `0fca5fa` makes the table and assets responsive and uses substantially more of the available viewport. It includes desktop and phone layout coverage. |
| Asset rendering and review route | **Fixed after follow-up review** | `/assets/` now reviews the logical suit, Princess, and round-card atlases through the shared regular-grid renderer; subsequent merged revisions standardized the art and restored the preferred Princess portraits. |
| Failed Prince lead during `1B77D2` | **Partially addressed** | Once Sleeping Beauty’s activation reaches shared state, action ownership now makes the lock and its owner visible. The first-click reservation race remains open, so this is not fully resolved. |
| Before-trick reservation and responses | **Open** | Interactive powers can still open a client-only picker before any event reserves play, and an existing `pendingPower` still blocks every other activation. |
| Duplicate Firestore commands | **Open** | UI actions still do not share a stable idempotency key, and most controls are not synchronously locked for the entire append. |
| Wedding Gift receipt and undo | **Open** | The UI says “Gift wrapped” but does not name the submitted card or permit replacement before the final gift arrives. |
| Princess-power confirmation | **Open** | Multi-step powers expose a chooser, but immediate one-use powers still have no consistent confirm/cancel step. |
| Mulan rules text and skipped-prompt explanation | **Open** | The reducer correctly excludes the Frog and requires a replacement, but the displayed text still omits both qualifications. |
| Alice returned-card highlight | **Open** | Pass selection is reset between rounds, not when the opening pass completes, so a returned matching card can still inherit the stale selected treatment. |
| Persistent scorecard | **Open** | The full scorecard is still available only in the round-results overlay. |
| Spectator mode | **Open** | There is no read-only spectator role or privacy-filtered public projection. |

## Replay findings

### Game `E38C0C`

Players were Alex/Rapunzel, Ola/Alice, Failed Princess/Mulan, Danny/Snow White, and Anna/Little Mermaid.

#### Blind Man’s Bluff triggered too late — confirmed

The round began with eight cards per player, so “after playing half a hand” means the remaining four cards should have passed right after four completed tricks. Instead, `blindTransferComplete` changed only at **20:54:47**, when trick six completed and every player had three cards left.

The reducer contains a literal `trickCount === 6` condition. That matches a three-player twelve-card hand but not the five-player eight-card hand in this game. The chat sequence—“did not work” at 20:48 and “worked later than it should have” at 20:55—matches the replay exactly. There is only a terse status message after the transfer, with no transition animation or inventory acknowledgment.

#### Mulan’s prompt was not tied to winning — not a winner-condition bug

The replay contains Mulan decision prompts after tricks that Mulan both won and lost. For example:

- At **20:15:59**, Mulan played Queens 7, Alex won, and the reducer opened a Mulan decision because Queens 2 and Queens 6 were valid replacements.
- At **20:19:37**, Mulan played Princes 10 and won; the reducer also opened a decision.
- Many later prompts likewise occurred after other players won.

The actual condition is whether Mulan still holds another card of the played suit. The Frog (Pets 8) is intentionally never exchangeable. Mulan played the Frog during Masquerade Ball and correctly received no prompt, but the displayed power text only says “swap your card for another of the same suit.” It omits both the Frog exception and the requirement that a replacement exist. The rules text is therefore incomplete even though the reducer behavior is consistent.

Recommended wording: **“After a trick fills, if you have another card of the same suit, you may swap it for your played card. The Frog cannot be swapped.”** An explicit “No legal Mulan swap” acknowledgment would also make skipped prompts understandable.

#### Alice’s returned-card highlight — supported with a likely cause

Alice successfully activated twice in the replay and returned one card from a won trick to every hand. The duplicate Alice activation events were rejected by the reducer, so the canonical card movement was correct.

The lingering highlight is likely caused by `selectedPassCards`: it is retained after the opening pass, and the hand renderer applies its selected style even after passing is complete. If Alice later returns a card whose label matches a card that recipient selected during the opening pass, that newly received card remains raised and gold-highlighted. Clear pass selection when the pass completes, or only render that selection style during the passing phase, and add a browser regression test covering an Alice-returned matching card.

### Game `1B77D2`

Players were Alex/Pocahontas, Charles/Sleeping Beauty, Ola/Alice, Patrick/Little Mermaid, Danny/Cinderella, and Completely Failed Princess/Thumbelina.

#### Unable to lead a Prince — symptom confirmed, Prince rules were correct

Princes broke at **21:04:12** when Patrick played Princes 11. Subsequent Prince plays were accepted, so the reducer’s broken-Princes state was correct.

At **21:05:13.471**, Charles activated Sleeping Beauty before an empty trick. Patrick attempted to lead Princes 8 at **21:05:13.610**, only 139 ms later. Patrick was the leader and the card was otherwise legal, but the reducer rejected the play because Sleeping Beauty had already created `pendingPower`.

This was an action-race and visibility problem, not a Prince legality problem. The table needs to show the lock and its owner immediately, and a local play attempted after the lock should explain why it was not accepted.

#### Sleeping Beauty ended the last trick without playing it — confirmed game-integrity bug

Sleeping Beauty began at 21:05:13 with one card left in every hand. Contributions were accepted in this order:

| Time | Player | Contributed card |
|---|---|---|
| 21:05:15 | Charles | Fairies 8 |
| 21:05:19 | Completely Failed Princess | Queens 1 |
| 21:05:20 | Patrick | Princes 8 |
| 21:05:23 | Ola | Queens 2 |
| 21:05:30 | Alex | Fairies 1 |
| 21:05:57 | Danny | Princes 10 |

The final contribution removed the last card from every hand. The reducer defines round completion as all hands being empty, without requiring `pendingPower` to be resolved. It therefore marked the round complete while Sleeping Beauty was still pending. No redistribution event followed, none of the six cards was played or captured, and the host dealt the next round.

The report that everyone handed over their last card and Sleeping Beauty “won the trick” describes the visual symptom; no one actually won that trick in canonical state. This violates card conservation at the round boundary and needs a P0 regression test.

#### Before-trick powers do not reserve or respond correctly — confirmed design gap

Interactive powers such as Sleeping Beauty initially open client-only controls. The first click does not append an event, so the leader is not blocked until the owner completes the first choice or explicitly begins collection. Other clients can race during that gap.

Once a `pendingPower` does exist, the reducer ignores every other activation. There is no priority or response window, so one before-trick power cannot respond to another. The current behavior is neither truly simultaneous nor an explicit ordered sequence.

The failed Prince lead and the final-trick Sleeping Beauty failure show that this is core game-state behavior, not only presentation.

#### Wedding Gift needs reversible commitment and acknowledgment — confirmed UX gap

The replay contains four Wedding Gift collection cycles. Each player’s chosen card is appended immediately, and play resumes as soon as the sixth valid gift arrives. There is no event for replacing or retracting a gift. The UI changes to “Gift wrapped · waiting for everyone” but does not clearly preserve a receipt showing the submitting player which card they committed.

Add a visible “You gifted X” receipt and allow Replace/Undo until the last player commits. Other players’ gifts should remain face-down. When the collection closes, animate six cards entering the gift pile and later animate the pile going to the trick winner.

#### Crystal Clear reveals were visible before all choices — confirmed

The six choices arrived sequentially:

| Time | Player | Suit |
|---|---|---|
| 21:33:41.412 | Alex | Fairies |
| 21:33:41.535 | Completely Failed Princess | Pets |
| 21:33:50.383 | Patrick | Queens |
| 21:33:52.672 | Charles | Fairies |
| 21:33:53.127 | Ola | Fairies |
| 21:33:53.563 | Danny | Pets |

The reducer writes each choice immediately into shared `revealedSuits`, and every client renders opponents’ revealed cards before all six submissions exist. Later players therefore had several seconds to react to earlier choices. The choices must remain sealed until everyone commits.

#### Princess choices were visible during selection — confirmed

Each `player/configured` event immediately puts that Princess name into the shared lobby player list, even while other players are still choosing. Princess options are also deterministically derived for every player in the shared projection. This permits strategic counter-selection.

At minimum, the lobby should show only “Ready” until everyone has committed and then reveal all Princesses together. For robust secrecy, choices/options—and other private information such as hands—cannot live in a stream readable in full by every client. This should be addressed as part of the same private-state design as Crystal Clear rather than by CSS alone.

### Cross-game event duplication — confirmed systemic issue

Both streams contain rapid, identical submissions from the same client:

- `E38C0C`: 21 exact repeats within one second, including 19 card plays, one Mulan decline, and one Alice activation.
- `1B77D2`: 27 exact repeats within one second, including 23 card plays, two Wedding Gifts, and two join events.

The reducer rejected the illegal second copies in the observed cases, so both games completed. However, each tap generated a new client sequence and therefore a distinct Firestore document. This creates noise, extra writes, and risk for actions that can remain legal twice. Controls should lock while an append is in flight, and logical commands should carry a stable idempotency key so retrying the same intent cannot create a second action.

## Feedback triage

| Feedback | Current conclusion | State |
|---|---|---|
| Sleeping Beauty ended the last trick without being played | Reducer integrity bug fixed and covered by the replay-derived regression | **Done** |
| Princess choices visible before everyone selects | Commit/reveal flow now seals individual choices until collective reveal | **Done** |
| Crystal Clear choices visible before others choose | Commit/reveal flow now seals suits until everyone commits | **Done** |
| Blind Man’s Bluff did not work, then worked late | Deal-aware threshold replaces the hard-coded six-trick trigger | **Done** |
| Legal cards should be auto-highlighted | Legal cards now receive a strong raised gold treatment; illegal cards are dimmed | **Done** |
| Highlight active player / make action owner obvious, including multiple players | Per-seat ownership highlights active and completed responders | **Done** |
| Cards and Princess-power font are too small; screen has unused purple space | Responsive layout now scales cards, Princesses, copy, and table use | **Done** |
| Unable to lead a Prince after Princes broke | The Prince was legal; shared lock visibility is fixed, but the pre-event click race remains | **Partial** |
| Leader must be blocked as soon as a before-trick power is clicked | Still a client-local intent gap for powers that first open a picker | **Open · P0** |
| Before-trick powers must respond to other before-trick powers | Reducer still has one `pendingPower` slot and no response phase | **Open · P0** |
| Duplicate rapid submissions | Observed events were usually rejected by projection rules, but commands are not idempotent | **Open · P1** |
| Wedding Gift should show the gift and allow undo | Generic completion marker exists; exact-card receipt and retraction do not | **Open · P1** |
| Princess power should get a confirmation | No consistent confirm/cancel contract for immediate one-use powers | **Open · P1** |
| Mulan text incomplete / Frog behavior | Logic is correct; displayed copy still omits the Frog and no-replacement conditions | **Open · P1** |
| Mulan prompt appears inconsistently / perhaps only when Mulan wins | Winner hypothesis disproved; a short skipped-action explanation remains desirable | **Open · P1 clarity** |
| Alice card remains highlighted on later tricks | Likely stale opening-pass selection remains in the client for the rest of the round | **Open · P1** |
| Add a scorecard button | Scorecard remains limited to the round-results overlay | **Open · P2** |
| Spectator mode | Requires a read-only role and a privacy-safe projection | **Open · P3** |

## Prioritized fix plan

### P0 — make before-trick actions deterministic

1. **Introduce advance BAT signaling and rolling priority.** Let players raise or lower a hand during the preceding trick—or the opening pass for trick one. If requested, block the next lead and cycle decisions in play order until every still-unused BAT player declines consecutively after the latest activation, as specified in [the proposed hand-raise/priority design](docs/design/BEFORE_TRICK_RESERVATION_RESPONSE.md).

2. **Resolve powers immediately within priority.** Replace the single `pendingPower` slot with a sequential priority window. Resolve each activated power before moving to the next eligible player, reset prior declines after every activation, and cover reconsideration, play-order tie-breaking, and final-trick Sleeping Beauty in reducer and browser tests.

These should be one coherent state-machine change. Advance signaling removes the same-trick lead race; rolling priority supplies deterministic tie-breaking and guarantees every unused BAT power can respond.

### P1 — make commands and power outcomes trustworthy

3. **Make submissions idempotent.** Lock the initiating control synchronously, reuse a stable command ID across retries, and ignore repeated command IDs in the projection. Add rapid-double-click coverage for card play, Princess activation, Sleeping Beauty contribution, round actions, and joining.

4. **Add confirmation, receipts, and reversible commitment.** Give immediate one-use Princess powers a consistent confirm/cancel step and accepted/rejected result. For Wedding Gift, show “You gifted X” and allow replacement until the last player commits, while keeping opponents’ cards face-down. Drive any transfer animation from accepted projection transitions.

5. **Close the two targeted Princess UX bugs.** Update Mulan’s text to include the replacement requirement and Frog exclusion, and explain when no swap exists. Clear or phase-gate `selectedPassCards` when passing completes, with an Alice regression proving a returned matching card is not highlighted.

6. **Run a focused replay and power-state audit.** Convert the two production streams into sanitized fixtures or smaller equivalent fixtures. Add a card-conservation invariant across hands, trick, captured piles, gifts, reserves, and pending zones, and exercise it at every replay prefix.

### P2 — improve access to existing information

7. **Add a persistent scorecard drawer/button.** Reuse the existing five-round table during live play. It must be read-only, keyboard accessible, usable on phone and desktop, and must not obscure required action feedback when opened.

8. **Re-review the responsive table with players.** The implementation and automated screenshots now cover the requested scaling, but the success criterion is human readability at the actual devices and player counts that produced the feedback. Treat any resulting spacing adjustments as bounded polish rather than another layout rewrite.

### P3 — add spectators after defining the privacy boundary

9. **Design spectator mode.** A spectator must not join as a player, consume a seat, or receive private hands, choice nonces, or unrevealed choices. Decide whether the current trusted-client model is acceptable; otherwise split public and player-private projections before exposing a read-only route.

## Suggested delivery slices

Keep the remaining work reviewable and reduce regression risk by shipping it in this order:

1. Before-trick reservation/response state machine, building on the merged ownership UI.
2. Stable command IDs and synchronous in-flight control locking.
3. Mulan and Alice fixes as a small targeted PR.
4. Wedding Gift receipt/retraction plus shared Princess confirmation behavior.
5. Persistent scorecard access and a short real-device table re-review.
6. Spectator/privacy design, followed by implementation only after that boundary is agreed.

The completed fixes should remain separate in history. The next PR should start with the before-trick protocol rather than reopening Sleeping Beauty, sealed-choice, Blind Man’s Bluff, responsive-layout, or asset work that is already on `main`.
