import { describe, expect, it } from 'vitest';
import { breaksPrinces, legalCards, trickWinner, type TrickState } from './trick-taking';
import type { Card } from './setup';

const card = (suit: Card['suit'], rank: number): Card => ({ suit, rank });

describe('base trick taking', () => {
  it('requires following suit and otherwise permits a void play', () => {
    const trick: TrickState = { leaderUid: 'a', plays: [{ uid: 'a', card: card('fairies', 4) }] };
    expect(legalCards([card('fairies', 2), card('pets', 8)], trick, false)).toEqual([card('fairies', 2)]);
    expect(legalCards([card('queens', 2), card('pets', 8)], trick, false)).toHaveLength(2);
  });

  it('restricts an unbroken Prince lead unless the hand contains only Princes', () => {
    const empty = (leaderUid: string): TrickState => ({ leaderUid, plays: [] });
    expect(legalCards([card('princes', 9), card('pets', 2)], empty('a'), false)).toEqual([card('pets', 2)]);
    expect(legalCards([card('princes', 9)], empty('a'), false)).toEqual([card('princes', 9)]);
  });

  it('awards the trick to the highest led suit and only breaks on a void Prince', () => {
    const trick: TrickState = { leaderUid: 'a', plays: [
      { uid: 'a', card: card('queens', 4) }, { uid: 'b', card: card('princes', 10) }, { uid: 'c', card: card('queens', 7) }
    ] };
    expect(trickWinner(trick)).toBe('c');
    expect(breaksPrinces({ leaderUid: 'a', plays: trick.plays.slice(0, 1) }, card('princes', 10))).toBe(true);
    expect(breaksPrinces({ leaderUid: 'a', plays: [] }, card('princes', 10))).toBe(false);
  });
});
