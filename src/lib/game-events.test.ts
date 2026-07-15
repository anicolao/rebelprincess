import { describe, expect, it } from 'vitest';
import { deriveGame, eventCursor, eventId, isGameEvent, normalizeGameId, replayCacheKey } from './game-events';

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
        { uid: 'host', displayName: 'Alex', host: true },
        { uid: 'guest', displayName: 'Jo', host: false }
      ]
    });
    expect(eventCursor([joined, created])).toEqual({ createdAtMillis: null, eventId: 'z' });
  });

  it('versions the replay cache with the reducer', () => {
    expect(replayCacheKey('MOON42')).toBe('rebel-princess:game:MOON42:reducer:1');
  });
});
