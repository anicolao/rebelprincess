# August 9 playtest feedback summary

## Scope and method

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

Blind Man’s Bluff has a separate confirmed rule bug: it always transfers after six tricks instead of after half of the dealt hand. Mulan’s trigger logic is working independently of trick winner, but its displayed rules omit two important conditions. Alice’s lingering highlight has a likely concrete UI-state cause.

The highest priority should be preserving cards and making before-trick actions deterministic. Visual polish should follow immediately because poor state visibility materially contributed to the playtest confusion.

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

| Feedback | Conclusion | Priority |
|---|---|---:|
| Sleeping Beauty ended the last trick without being played | Confirmed reducer integrity bug; empty hands incorrectly override unresolved pending cards | P0 |
| Leader must be blocked as soon as a before-trick power is clicked | Confirmed client-only intent gap | P0 |
| Before-trick powers must respond to other before-trick powers | Confirmed; reducer accepts only one pending power and has no response phase | P0 |
| Princess choices visible before everyone selects | Confirmed lobby/shared-state fairness leak | P0 |
| Crystal Clear choices visible before others choose | Confirmed UI and shared-state fairness leak | P0 |
| Blind Man’s Bluff did not work, then worked late | Confirmed; hard-coded six-trick trigger is wrong for this deal | P1 |
| Unable to lead a Prince after Princes broke | Not a Prince-rules bug; Sleeping Beauty won a 139 ms action race and silently locked play | P1 as part of action clarity |
| Wedding Gift should show the gift and allow undo | Confirmed missing receipt/retraction flow | P1 |
| Princess power should get a confirmation | Supported; add confirmation before consuming a one-use power and acknowledgment after acceptance | P1 |
| Legal cards should be auto-highlighted | Already highlighted by a one-pixel gold treatment, but playtest proves it is not salient enough | P1 |
| Highlight active player / make action owner obvious, including multiple players | Supported and reinforced by replayed races; current treatment is mainly text and only highlights the local leader | P1 |
| Mulan text incomplete / Frog behavior | Confirmed copy problem; Frog exclusion is intentional | P1 |
| Mulan prompt appears inconsistently / perhaps only when Mulan wins | Winner hypothesis disproved; prompt depends on having a legal same-suit non-Frog swap | P1 clarity |
| Alice card remains highlighted on later tricks | Supported with a likely stale `selectedPassCards` cause | P1 |
| Cards and Princess-power font are too small; screen has unused purple space | Confirmed by several players and supported by desktop CSS (cards cap at 78 px; opponent power copy is 7–8 px) | P2 |
| Add a scorecard button | Scorecard exists only in the round-results overlay; persistent access is absent | P2 |
| Spectator mode | Not implemented; requires an explicit privacy and joining model | P3 |

## Prioritized fix plan

### P0 — protect game integrity and fairness

1. **Fix Sleeping Beauty round completion.** A round cannot complete while `pendingPower`, `pendingMulanUid`, an unresolved round action, or cards held in a pending contribution pool exist. Add a focused reducer regression from the six final contributions above, plus a browser test that redistributes and then plays the real last trick. Assert conservation across hands, trick, captured piles, gifts, reserves, and pending zones at every event prefix.

2. **Introduce an explicit before-trick action window.** Model intent/reservation in shared state from the first click. Pause the leader immediately, display who opened the window, collect eligible responses in a deterministic priority order, and resolve a stack/queue before normal play resumes. Define cancellation/time-out behavior and ensure a rejected card play receives a visible reason. Cover multiple simultaneous responders and final-trick activation.

3. **Seal simultaneous/private choices.** Use commit/reveal or server-owned private documents for Princess choice and Crystal Clear. Do not reveal an individual choice until all required players commit. Hide lobby Princess identities until collective reveal. Document whether the project trusts players not to inspect Firestore; if it does not, separate public projection data from player-private hands and options.

### P1 — correct rules and make actions trustworthy

4. **Make Blind Man’s Bluff deal-aware.** Record the hand size at round start and trigger after half that hand has been played, rather than after six tricks. Define whether Alice-created extra cards affect the threshold; the least surprising interpretation is half of the original dealt hand. Test all player counts and Alice interaction.

5. **Make submissions idempotent.** Disable actionable controls immediately while their write is pending, retain one command id across retries, and have the reducer ignore repeated command ids. Add rapid double-click tests for play, power, contribution, gift, reveal, and join actions.

6. **Add an action-ownership layer.** Visually emphasize the active seat, not only text. When several players owe input, highlight all of them and show per-player completion markers. Strengthen legal-card treatment with contrast/dimming plus lift or glow, and preserve keyboard/focus accessibility. Show why a local action is blocked.

7. **Add confirmation and outcome feedback.** Confirm before committing an irreversible Princess power, then show an accepted/rejected acknowledgment. Add distinct animations for Blind Man’s Bluff hand transfer, Wedding Gift collection/award, Sleeping Beauty collection/redistribution, and other state-changing powers. Keep animation derived from accepted projection transitions, not optimistic clicks.

8. **Finish the targeted UX fixes.** Correct Mulan copy and show “no replacement” feedback; clear or phase-gate pass selections so Alice-returned cards do not inherit highlights; add Wedding Gift receipt and retraction events; keep other gifts face-down.

### P2 — improve readability and access

9. **Rework board sizing responsively.** Increase hand cards and trick cards, raise Princess power text to a readable minimum, allocate more of the viewport to active content, and reduce empty table space. Validate at the actual desktop and mobile viewport sizes used in the playtest, with 3–6 players.

10. **Add a persistent scorecard drawer/button.** Reuse the existing score table outside the end-of-round overlay and ensure opening it never blocks or changes play.

### P3 — add spectators after privacy boundaries are defined

11. **Design spectator mode.** A spectator must not join as a player, consume a seat, or gain private hands/choices. Define public versus player-private projection first, then add a read-only route with delayed or redacted information as appropriate.

## Suggested delivery slices

Keep the work reviewable and reduce regression risk by shipping it in this order:

1. Sleeping Beauty completion guard, conservation invariant, and replay fixture.
2. Blind Man’s Bluff threshold plus duplicate-action protection.
3. Before-trick reservation/response state machine and action-owner UI.
4. Sealed Princess and Crystal Clear choices.
5. Mulan, Alice, Wedding Gift, confirmation, and animation polish.
6. Responsive sizing, scorecard access, then spectator mode.

The two production streams should be converted into sanitized replay fixtures or smaller focused fixtures so these exact failures remain covered without tests depending on live Firestore.
