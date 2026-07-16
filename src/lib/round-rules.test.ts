import { describe, expect, it } from 'vitest';
import { isMasqueradeHidden, roundCardScore, roundTrickWinner } from './round-rules';

describe('introductory Round cards', () => {
  it('leaves teaching rounds unchanged and makes Queens trump under Royal Decree', () => {
    const trick = { leaderUid: 'a', plays: [
      { uid: 'a', card: { suit: 'fairies' as const, rank: 10 } },
      { uid: 'b', card: { suit: 'queens' as const, rank: 2 } },
      { uid: 'c', card: { suit: 'fairies' as const, rank: 9 } }
    ] };
    expect(roundTrickWinner(trick, 'once-upon-a-time')).toBe('a');
    expect(roundTrickWinner(trick, 'invitation')).toBe('a');
    expect(roundTrickWinner(trick, 'royal-decree')).toBe('b');
    expect(roundTrickWinner({ ...trick, plays: [...trick.plays, { uid: 'd', card: { suit: 'queens', rank: 8 } }], reversed: true }, 'royal-decree')).toBe('b');
  });

  it('adds one proposal per Pet while retaining the Frog’s five', () => {
    expect(roundCardScore([{ suit: 'pets', rank: 2 }, { suit: 'pets', rank: 8 }, { suit: 'princes', rank: 4 }], 'pets-revenge'))
      .toEqual({ princes: 1, frog: 5, roundRule: 2, total: 8 });
  });

  it('hides a Masquerade follower only until the trick is complete', () => {
    const partial = { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies' as const, rank: 2 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 3 } }] };
    expect(isMasqueradeHidden('masquerade-ball', partial, 'b', 3)).toBe(true);
    expect(isMasqueradeHidden('once-upon-a-time', partial, 'b', 3)).toBe(false);
  });
});
