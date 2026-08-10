import { describe, expect, it } from 'vitest';
import { deriveGame, eventCursor, eventId, gameWinners, isGameEvent, nextRoundLeader, normalizeGameId, replayCacheKey, type GameEvent, type GameEventType, type GameEventPayload } from './game-events';
import { princessOptionsForPlayers } from './setup';

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
      make('power/contributed', 'a', { powerId: 'sleeping-beauty', card: fairies(4) }),
      make('power/contributed', 'b', { powerId: 'sleeping-beauty', card: fairies(2) }),
      make('power/contributed', 'c', { powerId: 'sleeping-beauty', card: fairies(3) })
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
