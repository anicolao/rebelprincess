# Proposed realtime architecture

## Recommendation

Use Cloud Firestore for the first implementation. Rebel Princess is turn-based,
so Firestore snapshot listeners provide ample latency while transactions,
offline retry, and expressive Security Rules simplify room coordination. Unlike
`drm`, it does not need a high-frequency Realtime Database command stream.

As in `gotfive`, authenticated clients should append events and derive the
current game by replaying them through a deterministic, versioned reducer. No
Cloud Function needs to sit in the move path. The clients are trusted to run the
game correctly. Firebase only needs to ensure that signed-in clients can append
but cannot rewrite history; game legality, turn ownership, and selective display
of information belong to the client implementation.

## Proposed data model

```text
games/{gameId}/events/{eventId}  append-only events for the entire game
```

This one stream contains game creation, player joins, setup, the shuffle seed,
deals, passes, plays, Princess powers, captured tricks, scoring, and terminal
events. All players may read all of it, including every hand and card exchange.
A trustworthy client derives the full state but displays only the information
the local player should see. There is deliberately no server-enforced private
subtree and no attempt to prevent a curious or modified client from cheating.

The game ID can also serve as its room/invite ID. Lobby and membership state are
projections of the same stream rather than separate mutable documents. If a
public game browser is later required, it can be a disposable projection; it is
not part of the canonical game record.

Increment 3 deterministically deals two Princess options per seat from the game
ID; one `player/configured` event records each player's game-long choice and
readiness. A host-authored `game/dealt` event then contains the shuffle
seed, the ordered five Round-card IDs, and every player's complete hand. The
versioned reducer keeps all hands, while the trustworthy view renders only the
local UID's cards and opponent card counts. Deck composition is 36 cards for
three players, 40 for four or five, and 48 for six as specified in `RULES.md`.

Increment 4 adds `pass/submitted` events and compensating `pass/retracted`
events. Submissions contain the outgoing cards and are readable in the trusted
shared stream. While waiting, the client visibly marks those cards with their
named recipient but reveals no incoming cards; selecting a marked card appends
a retraction so the player can revise the choice. Once every seated UID has an
active submission, the reducer applies the Round card's left, right, or split
instruction in seat order, sorts each resulting hand, and verifies every
submitted card came from its actor's dealt hand. No mutable coordination or
resolution document is required.

Increment 5 adds `card/played` events. The reducer validates clockwise turns,
follow-suit choices, Prince breaking, trick winners, captured piles, and the
winner's next lead entirely from the active deal segment.

Increment 6 treats each `game/dealt` event as a round boundary. It replays each
deal with only the passes and plays that follow it, scores captured Princes at
one proposal and Pet 8/Frog at five, and carries cumulative totals forward. The
lowest cumulative scorer leads the next round; ties are scanned clockwise
beginning after the prior round leader. Princess choices remain fixed while
their powers refresh. The next host-authored `game/dealt` uses the original
ordered Round IDs, a new seed and fresh hands. Reusing these existing immutable
event types keeps round transition append-only without adding a mutable score or
round document.

Increment 7 derives the terminal result after the fifth completed round. The
lowest cumulative score wins; tied players are filtered to those with the most
zero-proposal rounds, and any remaining tie is a shared victory. Totals,
zero-round counts, and winner UIDs are deterministic projection data rather
than mutable result documents. A host-authored `game/rematched` marker starts a
fresh setup epoch in the same stream: membership persists, while Princess
choices, readiness, deals, scores, and Round cards replay only from after that
marker. Earlier game events remain immutable and fully replayable.

Increment 8 adds `power/activated` and `power/declined` decisions. The reducer
derives per-round exhaustion and per-trick modifiers without mutable Princess
documents. Snow White records an effective rank alongside the printed card;
Cinderella reverses winner comparison; Pocahontas changes the empty trick's
leader; the Pea Princess filters the base legal-card set; and an available
Mulan holds a filled trick at an observable decision point until she swaps a
valid same-suit card or declines. Princess precedence is applied after base legality
is established and before winner resolution.

Every event includes `type`, `payload`, `actorUid`, `clientSeq`, `createdAt` (server
timestamp), `schemaVersion`, and `reducerVersion`. Event documents are immutable.
Increment 2 uses `{actorUid}-{zero-padded clientSeq}` as the stable event ID and
orders equal timestamps by that ID. Its initial event types are `game/created`
and `player/joined`, each with `{gameId, displayName}` payloads. Moves
may carry the expected previous event ID and turn number so trustworthy clients
can identify duplicates or concurrent actions and resolve them deterministically.

## Trust and privacy boundaries

- Anonymous Firebase Auth gives every browser a stable UID for attribution.
- Every signed-in player may read the entire game stream, including all hands.
- A client may append an event attributed to its own UID; events cannot be
  updated or deleted.
- Trustworthy clients enforce turns and legal moves, validate the stream, and
  display only the hand and choices appropriate to the local player.
- Reducer/hash mismatches should be visible because they indicate a bug or
  incompatible client, not because they prove cheating.
- Presence and disconnect handling can be added later. If precise disconnect
  state becomes important, use a small Realtime Database presence projection;
  do not move game state there solely for presence.

## Implementation order

1. Specify event schemas, deterministic shuffle, and reducer versioning.
2. Write emulator-backed tests for authenticated reads, creates, and immutable
   events before allowing production access.
3. Implement anonymous auth, room creation/joining, and membership.
4. Implement dealing, selective client display, trick events, and replay.
5. Add reconnect, idempotency, conflict, and divergence tests.

The checked-in production rules allow signed-in users to read complete game
event streams and create valid immutable events attributed to their own UID.
Every other path and every update or delete remains denied.

## Visual asset references

The best single reference for the original component set is Zombi Paella's
[official second-edition English rulebook](https://zombipaella.com/wp-content/uploads/2024/02/rebelprincess-ed02_rulebook_en.pdf).
It shows card faces, suit symbols, card backs, Princess cards, Round cards, and
the scorepad in context. The
[official Bézier Games Deluxe product page](https://beziergames.com/products/rebel-princess-deluxe-edition)
and its linked rulebook are useful secondary references for the newer component
layout and production presentation. The original illustrations are credited to
Alfredo Cáceres.

Use these materials as a model for the required asset inventory, information
hierarchy, readability, fairy-tale subject matter, and differentiation among
suits—not as source files to copy or as a request to imitate the illustrator's
personal style. The published art, graphic design, logo, and card layouts are
copyrighted and are not licensed to this repository merely because they appear
online. New assets should therefore use original compositions, characters,
symbols, typography, and trade dress. If visual compatibility with the
commercial game is desired beyond reference/prototyping, obtain permission from
the publisher or rights holders first.
