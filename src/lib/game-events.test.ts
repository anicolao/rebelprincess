import { describe, expect, it } from 'vitest';
import { deriveGame, eventCursor, eventId, gameWinners, isGameEvent, nextRoundLeader, normalizeGameId, replayCacheKey, type GameEvent, type GameEventType, type GameEventPayload } from './game-events';
import { cardLabel, princessOptionsForPlayers, type Card } from './setup';
import { choiceCommitment, crystalClearChoiceScope, princessChoiceScope } from './choice-commitment';

const event = (id: string, type: GameEventType, uid: string, name: string) => ({
  id,
  type,
  payload: { gameId: 'MOON42', displayName: name },
  actorUid: uid,
  clientSeq: 1,
  createdAt: null,
  schemaVersion: 1 as const,
  reducerVersion: 1 as const
});

function blindMansBluffEvents(playerCount: number, completedTricks: number, aliceReturnsFirstTrick = false): GameEvent[] {
  let sequence = 0;
  const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
    id: String(++sequence).padStart(4, '0'), type, payload: { gameId: `BLIND${playerCount}`, ...payload }, actorUid,
    clientSeq: sequence, createdAt: null, schemaVersion: 1, reducerVersion: 1
  });
  const uids = Array.from({ length: playerCount }, (_, index) => String.fromCharCode(97 + index));
  const handSize = playerCount === 3 ? 12 : playerCount === 4 ? 10 : 8;
  const transferAfter = handSize / 2;
  const fillerSuits: Card['suit'][] = ['queens', 'princes', 'pets'];
  const hands = Object.fromEntries(uids.map((uid, playerIndex) => {
    const fairies: Card[] = Array.from({ length: transferAfter }, (_, index) => ({ suit: 'fairies', rank: index + 1 }));
    const fillers: Card[] = Array.from({ length: handSize - transferAfter }, (_, index) => {
      const offset = playerIndex * (handSize - transferAfter) + index;
      return { suit: fillerSuits[Math.floor(offset / 12)], rank: offset % 12 + 1 };
    });
    return [uid, [...fairies, ...fillers]];
  }));
  const events = [
    make('game/created', uids[0], { displayName: 'Player 1' }),
    ...uids.slice(1).map((uid, index) => make('player/joined', uid, { displayName: `Player ${index + 2}` })),
    ...(aliceReturnsFirstTrick ? [make('player/configured', uids[0], { princessId: 'alice', ready: true })] : []),
    make('game/dealt', uids[0], {
      seed: `blind-${playerCount}`,
      roundIds: ['blind-mans-bluff', 'once-upon-a-time', 'masquerade-ball', 'royal-decree', 'musical-chairs'],
      hands
    }),
    ...uids.map((uid) => make('pass/submitted', uid, { cards: [hands[uid].at(-1)!] }))
  ];
  for (let trick = 1; trick <= completedTricks; trick += 1) {
    events.push(...uids.map((uid) => make('card/played', uid, { card: { suit: 'fairies', rank: trick } })));
    if (trick === 1 && aliceReturnsFirstTrick) events.push(make('power/activated', uids[0], { powerId: 'alice' }));
  }
  return events;
}

describe('append-only game events', () => {
  it('normalizes invite codes and creates stable event identifiers', () => {
    expect(normalizeGameId(' moon-42! ')).toBe('MOON42');
    expect(eventId('guest', 7)).toBe('guest-0000000007');
  });

  it('validates envelopes and deterministically derives unique membership', () => {
    const joined = event('z', 'player/joined', 'guest', 'Jo');
    const created = event('a', 'game/created', 'host', 'Alex');
    expect(isGameEvent(joined)).toBe(true);
    expect(deriveGame([joined, created])).toEqual({
      gameId: 'MOON42',
      players: [
        { uid: 'host', displayName: 'Alex', host: true, ready: false },
        { uid: 'guest', displayName: 'Jo', host: false, ready: false }
      ],
      roundIds: [],
      hands: null,
      seed: null,
      passSubmissions: {},
      passComplete: false,
      trick: null,
      currentTurnUid: null,
      princesBroken: false,
      capturedCounts: { host: 0, guest: 0 },
      capturedTricks: { host: [], guest: [] },
      lastCompletedTrick: null,
      completedTricks: 0,
      roundIndex: 0,
      roundComplete: false,
      roundScores: { host: { princes: 0, frog: 0, roundRule: 0, total: 0 }, guest: { princes: 0, frog: 0, roundRule: 0, total: 0 } },
      roundScoreHistory: [],
      totalScores: { host: 0, guest: 0 },
      nextLeaderUid: 'host',
      princessOptions: princessOptionsForPlayers(['host', 'guest'], 'MOON42'),
      princessCommitments: {},
      gameNumber: 0,
      gameComplete: false,
      zeroRounds: { host: 0, guest: 0 },
      winnerUids: [],
      exhaustedPrincessUids: [],
      powerIdsThisTrick: [],
      pendingMulanUid: null,
      pendingPower: null,
      forcedCards: {},
      awaitingRoundAction: null,
      roundActionSubmissions: {},
      roundCardSubmissions: {},
      revealedSuits: {},
      suitCommitments: {},
      retainedCards: { host: [], guest: [] },
      haggleWinnerUid: null,
      blindTransferComplete: false,
      rebelUids: [],
      artworkOption: 'classic'
    });
    expect(eventCursor([joined, created])).toEqual({ createdAtMillis: null, eventId: 'z' });
  });

  it('derives artworkOption correctly from player/configured events', () => {
    const created = event('a', 'game/created', 'host', 'Alex');
    const configured = { ...event('b', 'player/configured', 'host', 'Alex'), type: 'player/configured' as const, payload: { gameId: 'MOON42', artworkOption: 'alternate', ready: false } };
    const projection = deriveGame([created, configured]);
    expect(projection.artworkOption).toBe('alternate');
  });

  it('replays readiness, Princess choice, rounds, and the complete shared deal', () => {
    const events = [
      event('a', 'game/created', 'host', 'Alex'),
      event('b', 'player/joined', 'guest', 'Jo'),
      { ...event('c', 'player/joined', 'guest', 'Jo'), type: 'player/configured' as const, payload: { gameId: 'MOON42', princessId: 'little-mermaid', ready: true } },
      { ...event('d', 'game/created', 'host', 'Alex'), type: 'player/configured' as const, payload: { gameId: 'MOON42', princessId: 'snow-white', ready: true } },
      { ...event('e', 'game/created', 'host', 'Alex'), type: 'game/dealt' as const, payload: { gameId: 'MOON42', seed: 'fixed', roundIds: ['a', 'b', 'c', 'd', 'e'], hands: { host: [{ suit: 'fairies' as const, rank: 2 }], guest: [{ suit: 'pets' as const, rank: 8 }] } } }
    ];
    const projection = deriveGame(events);
    expect(projection.players.map(({ princessId, ready }) => ({ princessId, ready }))).toEqual([
      { princessId: 'snow-white', ready: true },
      { princessId: 'little-mermaid', ready: true }
    ]);
    expect(projection.roundIds).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(projection.hands?.guest[0]).toEqual({ suit: 'pets', rank: 8 });
  });

  it('keeps Princess choices sealed until every committed choice is validly revealed', () => {
    let sequence = 0;
    const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
      id: String(++sequence).padStart(2, '0'), type, payload: { gameId: 'SEALED6', ...payload }, actorUid,
      clientSeq: sequence, createdAt: null, schemaVersion: 1, reducerVersion: 1
    });
    const uids = ['a', 'b', 'c'];
    const options = princessOptionsForPlayers(uids, 'SEALED6');
    const choices = Object.fromEntries(uids.map((uid) => [uid, options[uid][0]]));
    const nonces = { a: 'nonce-a', b: 'nonce-b', c: 'nonce-c' };
    const events = [
      make('game/created', 'a', { displayName: 'Alex' }),
      make('player/joined', 'b', { displayName: 'Jo' }),
      make('player/joined', 'c', { displayName: 'Sam' }),
      ...uids.map((uid) => make('player/princess-committed', uid, {
        commitment: choiceCommitment(princessChoiceScope('SEALED6', 0, uid), choices[uid], nonces[uid as keyof typeof nonces])
      })),
      make('player/joined', 'late', { displayName: 'Late arrival' }),
      make('player/configured', 'a', { princessId: choices.a, nonce: nonces.a, ready: true }),
      make('player/configured', 'b', { princessId: choices.b, nonce: nonces.b, ready: true }),
      make('player/configured', 'c', { princessId: choices.c, nonce: 'wrong', ready: true })
    ];

    const stillSealed = deriveGame(events);
    expect(stillSealed.players.map((player) => player.uid)).toEqual(uids);
    expect(stillSealed.players.every((player) => !player.ready && player.princessId === undefined)).toBe(true);
    expect(Object.keys(stillSealed.princessCommitments)).toEqual(uids);

    events.push(make('player/configured', 'c', { princessId: choices.c, nonce: nonces.c, ready: true }));
    const revealedTogether = deriveGame(events);
    expect(revealedTogether.players.map((player) => ({ uid: player.uid, princessId: player.princessId, ready: player.ready }))).toEqual(
      uids.map((uid) => ({ uid, princessId: choices[uid], ready: true }))
    );
  });

  it('keeps Crystal Clear suits private until every commitment is validly revealed', () => {
    let sequence = 0;
    const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
      id: String(++sequence).padStart(2, '0'), type, payload: { gameId: 'CRYSTAL6', ...payload }, actorUid,
      clientSeq: sequence, createdAt: null, schemaVersion: 1, reducerVersion: 1
    });
    const card = (suit: 'fairies' | 'queens', rank: number) => ({ suit, rank });
    const choices = { a: 'fairies' as const, b: 'queens' as const, c: 'fairies' as const };
    const nonces = { a: 'nonce-a', b: 'nonce-b', c: 'nonce-c' };
    const events = [
      make('game/created', 'a', { displayName: 'Alex' }),
      make('player/joined', 'b', { displayName: 'Jo' }),
      make('player/joined', 'c', { displayName: 'Sam' }),
      make('game/dealt', 'a', { seed: 'crystal', roundIds: ['crystal-clear', 'once-upon-a-time', 'masquerade-ball', 'royal-decree', 'musical-chairs'], hands: {
        a: [card('fairies', 2), card('queens', 2)],
        b: [card('fairies', 3), card('queens', 3)],
        c: [card('fairies', 4), card('queens', 4)]
      } }),
      make('pass/submitted', 'a', { cards: [card('fairies', 2), card('queens', 2)] }),
      make('pass/submitted', 'b', { cards: [card('fairies', 3), card('queens', 3)] }),
      make('pass/submitted', 'c', { cards: [card('fairies', 4), card('queens', 4)] }),
      ...(['a', 'b', 'c'] as const).map((uid) => make('round/suit-committed', uid, {
        commitment: choiceCommitment(crystalClearChoiceScope('CRYSTAL6', 0, 0, uid), choices[uid], nonces[uid])
      })),
      make('round/suit-revealed', 'a', { suit: choices.a, nonce: nonces.a }),
      make('round/suit-revealed', 'b', { suit: choices.b, nonce: nonces.b }),
      make('round/suit-revealed', 'c', { suit: choices.c, nonce: 'wrong' })
    ];

    const stillSealed = deriveGame(events);
    expect(stillSealed.revealedSuits).toEqual({});
    expect(Object.keys(stillSealed.suitCommitments)).toEqual(['a', 'b', 'c']);
    expect(stillSealed.awaitingRoundAction).toBe('reveal-suit');

    events.push(make('round/suit-revealed', 'c', { suit: choices.c, nonce: nonces.c }));
    const revealedTogether = deriveGame(events);
    expect(revealedTogether.revealedSuits).toEqual(choices);
    expect(revealedTogether.awaitingRoundAction).toBeNull();
    expect(revealedTogether.currentTurnUid).toBe('a');
  });

  it.each([
    { playerCount: 3, originalHandSize: 12, transferAfter: 6 },
    { playerCount: 4, originalHandSize: 10, transferAfter: 5 },
    { playerCount: 5, originalHandSize: 8, transferAfter: 4 },
    { playerCount: 6, originalHandSize: 8, transferAfter: 4 }
  ])('passes Blind Man’s Bluff hands after half the original $originalHandSize-card deal for $playerCount players', ({ playerCount, originalHandSize, transferAfter }) => {
    const before = deriveGame(blindMansBluffEvents(playerCount, transferAfter - 1));
    expect(before.completedTricks).toBe(transferAfter - 1);
    expect(before.blindTransferComplete).toBe(false);

    const after = deriveGame(blindMansBluffEvents(playerCount, transferAfter));
    const uids = after.players.map((player) => player.uid);
    const remainingBeforeTransfer = Object.fromEntries(uids.map((uid) => [
      uid,
      before.hands![uid].filter((card) => card.suit !== 'fairies' || card.rank !== transferAfter)
    ]));
    expect(after.completedTricks).toBe(transferAfter);
    expect(after.blindTransferComplete).toBe(true);
    for (const [index, uid] of uids.entries()) {
      const sourceOnLeft = uids[(index + 1) % uids.length];
      expect(after.hands![uid].map(cardLabel)).toEqual(remainingBeforeTransfer[sourceOnLeft].map(cardLabel));
    }
    expect(Object.values(after.hands!).flat()).toHaveLength(playerCount * (originalHandSize - transferAfter));
  });

  it('uses the original Blind Man’s Bluff deal size when Alice adds cards back to every hand', () => {
    const before = deriveGame(blindMansBluffEvents(5, 3, true));
    expect(before.completedTricks).toBe(3);
    expect(before.blindTransferComplete).toBe(false);
    expect(Object.values(before.hands!).every((hand) => hand.length === 6)).toBe(true);

    const after = deriveGame(blindMansBluffEvents(5, 4, true));
    expect(after.completedTricks).toBe(4);
    expect(after.blindTransferComplete).toBe(true);
    expect(Object.values(after.hands!).every((hand) => hand.length === 5)).toBe(true);
    expect(Object.values(after.hands!).flat()).toHaveLength(25);
  });

  it('versions the replay cache with the reducer', () => {
    expect(replayCacheKey('MOON42')).toBe('rebel-princess:game:MOON42:reducer:1');
  });

  it('accepts an append-only pass retraction envelope', () => {
    expect(isGameEvent({
      type: 'pass/retracted', payload: { gameId: 'MOON42' }, actorUid: 'host',
      clientSeq: 4, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
  });

  it('accepts an append-only card play envelope', () => {
    expect(isGameEvent({
      type: 'card/played', payload: { gameId: 'MOON42', card: { suit: 'pets', rank: 8 } }, actorUid: 'host',
      clientSeq: 5, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
  });

  it('accepts append-only Princess activation and decline envelopes', () => {
    expect(isGameEvent({
      type: 'power/activated', payload: { gameId: 'MOON42', powerId: 'pocahontas', targetUid: 'guest' }, actorUid: 'host',
      clientSeq: 6, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
    expect(isGameEvent({
      type: 'power/contributed', payload: { gameId: 'MOON42', powerId: 'sleeping-beauty', card: { suit: 'fairies', rank: 2 } }, actorUid: 'guest',
      clientSeq: 8, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
    expect(isGameEvent({
      type: 'power/declined', payload: { gameId: 'MOON42', powerId: 'mulan' }, actorUid: 'host',
      clientSeq: 7, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
  });

  it('accepts attributed Round-action card envelopes', () => {
    for (const type of ['round/card-set-aside', 'round/pass-submitted'] as const) expect(isGameEvent({
      type, payload: { gameId: 'MOON42', card: { suit: 'queens', rank: 4 } }, actorUid: 'host',
      clientSeq: 9, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
  });

  it('validates sealed-choice commitment envelopes', () => {
    for (const type of ['player/princess-committed', 'round/suit-committed'] as const) expect(isGameEvent({
      type, payload: { gameId: 'MOON42', commitment: 'a'.repeat(64) }, actorUid: 'host',
      clientSeq: 10, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(true);
    expect(isGameEvent({
      type: 'round/suit-committed', payload: { gameId: 'MOON42', commitment: 'not-a-hash' }, actorUid: 'host',
      clientSeq: 11, createdAt: null, schemaVersion: 1, reducerVersion: 1
    })).toBe(false);
  });

  it('scores Princes and the Frog and carries the last winner into the next round', () => {
    let sequence = 0;
    const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
      id: String(++sequence).padStart(2, '0'), type, payload: { gameId: 'SCORE6', ...payload }, actorUid,
      clientSeq: sequence, createdAt: null, schemaVersion: 1, reducerVersion: 1
    });
    const events = [
      make('game/created', 'a', { displayName: 'Alex' }),
      make('player/joined', 'b', { displayName: 'Jo' }),
      make('player/joined', 'c', { displayName: 'Sam' }),
      make('game/dealt', 'a', { seed: 'one', roundIds: ['invitation', 'once-upon-a-time', 'masquerade-ball', 'royal-decree', 'musical-chairs'], hands: {
        a: [{ suit: 'fairies', rank: 2 }, { suit: 'princes', rank: 2 }],
        b: [{ suit: 'fairies', rank: 3 }, { suit: 'pets', rank: 8 }],
        c: [{ suit: 'fairies', rank: 4 }, { suit: 'queens', rank: 2 }]
      } }),
      make('pass/submitted', 'a', { cards: [{ suit: 'fairies', rank: 2 }, { suit: 'princes', rank: 2 }] }),
      make('pass/submitted', 'b', { cards: [{ suit: 'fairies', rank: 3 }, { suit: 'pets', rank: 8 }] }),
      make('pass/submitted', 'c', { cards: [{ suit: 'fairies', rank: 4 }, { suit: 'queens', rank: 2 }] }),
      make('card/played', 'a', { card: { suit: 'fairies', rank: 3 } }),
      make('card/played', 'b', { card: { suit: 'fairies', rank: 4 } }),
      make('card/played', 'c', { card: { suit: 'fairies', rank: 2 } }),
      make('card/played', 'b', { card: { suit: 'queens', rank: 2 } }),
      make('card/played', 'c', { card: { suit: 'princes', rank: 2 } }),
      make('card/played', 'a', { card: { suit: 'pets', rank: 8 } })
    ];
    const scored = deriveGame(events);
    expect(scored.roundComplete).toBe(true);
    expect(scored.roundScores.b).toEqual({ princes: 1, frog: 5, roundRule: 0, total: 6 });
    expect(scored.roundScoreHistory).toEqual([scored.roundScores]);
    expect(scored.totalScores.b).toBe(6);
    expect(scored.nextLeaderUid).toBe('c');

    const nextHands = {
      a: [{ suit: 'fairies' as const, rank: 2 }, { suit: 'queens' as const, rank: 2 }],
      b: [{ suit: 'fairies' as const, rank: 3 }, { suit: 'queens' as const, rank: 3 }],
      c: [{ suit: 'fairies' as const, rank: 4 }, { suit: 'queens' as const, rank: 4 }]
    };
    const advanced = deriveGame([...events, make('game/dealt', 'a', { seed: 'two', roundIds: scored.roundIds, hands: nextHands })]);
    expect(advanced.roundIndex).toBe(1);
    expect(advanced.totalScores.b).toBe(6);
    expect(advanced.roundScoreHistory).toEqual([scored.roundScores]);
    expect(advanced.roundComplete).toBe(false);
    expect(advanced.trick).toBeNull();
  });

  it('keeps the round open while Sleeping Beauty holds every final card', () => {
    let sequence = 0;
    const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
      id: String(++sequence).padStart(2, '0'), type, payload: { gameId: 'SLEEP6', ...payload }, actorUid,
      clientSeq: sequence, createdAt: null, schemaVersion: 1, reducerVersion: 1
    });
    const fairies = (rank: number) => ({ suit: 'fairies' as const, rank });
    const events = [
      make('game/created', 'a', { displayName: 'Alex' }),
      make('player/joined', 'b', { displayName: 'Jo' }),
      make('player/joined', 'c', { displayName: 'Sam' }),
      make('player/configured', 'a', { princessId: 'sleeping-beauty', ready: true }),
      make('game/dealt', 'a', { seed: 'last-trick', roundIds: ['single-fairy', 'once-upon-a-time', 'masquerade-ball', 'royal-decree', 'musical-chairs'], hands: {
        a: [fairies(2)], b: [fairies(3)], c: [fairies(4)]
      } }),
      make('pass/submitted', 'a', { cards: [fairies(2)] }),
      make('pass/submitted', 'b', { cards: [fairies(3)] }),
      make('pass/submitted', 'c', { cards: [fairies(4)] }),
      make('power/activated', 'a', { powerId: 'sleeping-beauty' }),
      make('power/contributed', 'c', { powerId: 'sleeping-beauty', card: fairies(3) }),
      make('power/contributed', 'a', { powerId: 'sleeping-beauty', card: fairies(4) }),
      make('power/contributed', 'b', { powerId: 'sleeping-beauty', card: fairies(2) })
    ];

    const collecting = deriveGame(events);
    expect(collecting.hands).toEqual({ a: [], b: [], c: [] });
    expect(collecting.pendingPower).toEqual({
      powerId: 'sleeping-beauty', actorUid: 'a', cards: [
        { uid: 'a', card: fairies(4) }, { uid: 'b', card: fairies(2) }, { uid: 'c', card: fairies(3) }
      ]
    });
    expect(collecting.roundComplete).toBe(false);
    expect(collecting.roundScoreHistory).toEqual([]);

    events.push(make('power/activated', 'a', {
      powerId: 'sleeping-beauty', cards: [fairies(4), fairies(2), fairies(3)]
    }));
    const redistributed = deriveGame(events);
    expect(redistributed.pendingPower).toBeNull();
    expect(redistributed.hands).toEqual({ a: [fairies(4)], b: [fairies(2)], c: [fairies(3)] });
    expect(redistributed.roundComplete).toBe(false);

    events.push(
      make('card/played', 'a', { card: fairies(4) }),
      make('card/played', 'b', { card: fairies(2) }),
      make('card/played', 'c', { card: fairies(3) })
    );
    const completed = deriveGame(events);
    expect(completed.roundComplete).toBe(true);
    expect(completed.completedTricks).toBe(1);
    expect(completed.capturedCounts.a).toBe(3);
  });

  it('chooses the unique lowest total, then breaks a low-score tie clockwise after the last leader', () => {
    expect(nextRoundLeader(['a', 'b', 'c'], { a: 4, b: 1, c: 7 }, 'a')).toBe('b');
    expect(nextRoundLeader(['a', 'b', 'c'], { a: 2, b: 2, c: 5 }, 'c')).toBe('a');
    expect(nextRoundLeader(['a', 'b', 'c'], { a: 2, b: 2, c: 2 }, 'a')).toBe('b');
  });

  it('breaks final score ties with zero-proposal rounds and otherwise shares victory', () => {
    expect(gameWinners(['a', 'b', 'c'], { a: 8, b: 8, c: 10 }, { a: 2, b: 1, c: 3 })).toEqual(['a']);
    expect(gameWinners(['a', 'b', 'c'], { a: 8, b: 8, c: 10 }, { a: 2, b: 2, c: 3 })).toEqual(['a', 'b']);
  });

  it('resets setup after an append-only rematch marker while retaining membership', () => {
    const rematched = deriveGame([
      event('a', 'game/created', 'host', 'Alex'),
      event('b', 'player/joined', 'guest', 'Jo'),
      { ...event('c', 'game/created', 'host', 'Alex'), type: 'player/configured' as const, payload: { gameId: 'MOON42', princessId: 'snow-white', ready: true } },
      { ...event('d', 'game/created', 'host', 'Alex'), type: 'game/rematched' as const, payload: { gameId: 'MOON42' } }
    ]);
    expect(rematched.players.map((player) => ({ name: player.displayName, ready: player.ready }))).toEqual([
      { name: 'Alex', ready: false }, { name: 'Jo', ready: false }
    ]);
    expect(rematched.gameNumber).toBe(1);
    expect(rematched.hands).toBeNull();
    expect(rematched.princessOptions).toEqual(princessOptionsForPlayers(['host', 'guest'], 'MOON42:rematch:1'));
  });
});
