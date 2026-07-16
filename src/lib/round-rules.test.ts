import { describe, expect, it } from 'vitest';
import { isMasqueradeHidden, roundCardScore, roundLegalCards, roundTrickWinner } from './round-rules';

describe('introductory Round cards', () => {
  it('limits Magic Beans to each otherwise-legal suit’s highest and lowest cards', () => {
    const hand = [{ suit: 'fairies' as const, rank: 2 }, { suit: 'fairies' as const, rank: 6 }, { suit: 'fairies' as const, rank: 9 }, { suit: 'pets' as const, rank: 4 }];
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies', rank: 5 } }] }, false, 'magic-beans')).toEqual([hand[0], hand[2]]);
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'queens', rank: 5 } }] }, false, 'magic-beans')).toEqual([hand[0], hand[2], hand[3]]);
  });
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

  it('subtracts three proposals for every 3 under Three Times a Lady', () => {
    expect(roundCardScore([{ suit: 'queens', rank: 3 }, { suit: 'princes', rank: 3 }], 'three-times-a-lady'))
      .toEqual({ princes: 1, frog: 0, roundRule: -6, total: -5 });
  });

  it('adds five proposals to a trickless player under Arranged Marriage', () => {
    expect(roundCardScore([], 'arranged-marriage')).toEqual({ princes: 0, frog: 0, roundRule: 5, total: 5 });
    expect(roundCardScore([{ suit: 'fairies', rank: 2 }], 'arranged-marriage')).toEqual({ princes: 0, frog: 0, roundRule: 0, total: 0 });
  });

  it('hides a Masquerade follower only until the trick is complete', () => {
    const partial = { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies' as const, rank: 2 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 3 } }] };
    expect(isMasqueradeHidden('masquerade-ball', partial, 'b', 3)).toBe(true);
    expect(isMasqueradeHidden('once-upon-a-time', partial, 'b', 3)).toBe(false);
  });
});
