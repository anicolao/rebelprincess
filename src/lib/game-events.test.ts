import { describe, expect, it } from 'vitest';
import { deriveGame, eventCursor, eventId, isGameEvent, normalizeGameId, replayCacheKey, type GameEvent, type GameEventType, type GameEventPayload } from './game-events';

const event = (id: string, type: 'game/created' | 'player/joined', uid: string, name: string) => ({
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
      roundScores: { host: { princes: 0, frog: 0, total: 0 }, guest: { princes: 0, frog: 0, total: 0 } },
      totalScores: { host: 0, guest: 0 },
      nextLeaderUid: 'host'
    });
    expect(eventCursor([joined, created])).toEqual({ createdAtMillis: null, eventId: 'z' });
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
      make('game/dealt', 'a', { seed: 'one', roundIds: ['once-upon-a-time', 'invitation', 'masquerade-ball', 'royal-decree', 'musical-chairs'], hands: {
        a: [{ suit: 'fairies', rank: 2 }, { suit: 'princes', rank: 2 }],
        b: [{ suit: 'fairies', rank: 3 }, { suit: 'pets', rank: 8 }],
        c: [{ suit: 'fairies', rank: 4 }, { suit: 'queens', rank: 2 }]
      } }),
      make('pass/submitted', 'a', { cards: [{ suit: 'fairies', rank: 2 }, { suit: 'princes', rank: 2 }] }),
      make('pass/submitted', 'b', { cards: [{ suit: 'fairies', rank: 3 }, { suit: 'pets', rank: 8 }] }),
      make('pass/submitted', 'c', { cards: [{ suit: 'fairies', rank: 4 }, { suit: 'queens', rank: 2 }] }),
      make('card/played', 'a', { card: { suit: 'fairies', rank: 4 } }),
      make('card/played', 'b', { card: { suit: 'fairies', rank: 2 } }),
      make('card/played', 'c', { card: { suit: 'fairies', rank: 3 } }),
      make('card/played', 'a', { card: { suit: 'queens', rank: 2 } }),
      make('card/played', 'b', { card: { suit: 'princes', rank: 2 } }),
      make('card/played', 'c', { card: { suit: 'pets', rank: 8 } })
    ];
    const scored = deriveGame(events);
    expect(scored.roundComplete).toBe(true);
    expect(scored.roundScores.a).toEqual({ princes: 1, frog: 5, total: 6 });
    expect(scored.totalScores.a).toBe(6);
    expect(scored.nextLeaderUid).toBe('a');

    const nextHands = {
      a: [{ suit: 'fairies' as const, rank: 2 }, { suit: 'queens' as const, rank: 2 }],
      b: [{ suit: 'fairies' as const, rank: 3 }, { suit: 'queens' as const, rank: 3 }],
      c: [{ suit: 'fairies' as const, rank: 4 }, { suit: 'queens' as const, rank: 4 }]
    };
    const advanced = deriveGame([...events, make('game/dealt', 'a', { seed: 'two', roundIds: scored.roundIds, hands: nextHands })]);
    expect(advanced.roundIndex).toBe(1);
    expect(advanced.totalScores.a).toBe(6);
    expect(advanced.roundComplete).toBe(false);
  });
});
