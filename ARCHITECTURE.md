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

Every event should include `type`, `actorUid`, `clientSeq`, `createdAt` (server
timestamp), `schemaVersion`, and `reducerVersion`. Event documents are immutable.
Use a stable sortable event ID as the tie-breaker when timestamps match. Moves
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

The checked-in production rules currently deny every read and write on purpose.

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
