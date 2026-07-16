import { describe, expect, it } from 'vitest';
import { cardsPerTrick, isMasqueradeHidden, roundCardScore, roundLegalCards, roundTrickWinner } from './round-rules';

describe('introductory Round cards', () => {
  it('limits Magic Beans to each otherwise-legal suit’s highest and lowest cards', () => {
    const hand = [{ suit: 'fairies' as const, rank: 2 }, { suit: 'fairies' as const, rank: 6 }, { suit: 'fairies' as const, rank: 9 }, { suit: 'pets' as const, rank: 4 }];
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies', rank: 5 } }] }, false, 'magic-beans')).toEqual([hand[0], hand[2]]);
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'queens', rank: 5 } }] }, false, 'magic-beans')).toEqual([hand[0], hand[2], hand[3]]);
  });
  it('applies Odds and Evens parity after the ordinary suit obligation', () => {
    const hand = [{ suit: 'fairies' as const, rank: 2 }, { suit: 'fairies' as const, rank: 5 }, { suit: 'pets' as const, rank: 7 }];
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies', rank: 9 } }] }, false, 'odds-and-evens')).toEqual([hand[1]]);
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'queens', rank: 9 } }] }, false, 'odds-and-evens')).toEqual([hand[1], hand[2]]);
  });
  it('lets Fairies follow as Midnight Makeover wild cards', () => {
    const hand = [{ suit: 'queens' as const, rank: 2 }, { suit: 'fairies' as const, rank: 8 }, { suit: 'pets' as const, rank: 12 }];
    expect(roundLegalCards(hand, { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'queens', rank: 5 } }] }, false, 'midnight-makeover')).toEqual([hand[0], hand[1]]);
  });
  it('changes the Pass the Bouquet suit when a new suit appears', () => {
    const hand = [{ suit: 'queens' as const, rank: 2 }, { suit: 'pets' as const, rank: 8 }];
    const trick = { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies' as const, rank: 9 } }, { uid: 'b', card: { suit: 'queens' as const, rank: 4 } }] };
    expect(roundLegalCards(hand, trick, false, 'pass-the-bouquet')).toEqual([hand[0]]);
    expect(roundTrickWinner({ ...trick, plays: [...trick.plays, { uid: 'c', card: { suit: 'queens' as const, rank: 7 } }] }, 'pass-the-bouquet')).toBe('c');
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
    expect(roundTrickWinner({ ...trick, reversed: true }, 'upside-down')).toBe('c');
  });

  it('awards Always the Bridesmaid to the second-highest led-suit card', () => {
    const trick = { leaderUid: 'a', plays: [
      { uid: 'a', card: { suit: 'fairies' as const, rank: 10 } },
      { uid: 'b', card: { suit: 'fairies' as const, rank: 4 } },
      { uid: 'c', card: { suit: 'fairies' as const, rank: 8 } }
    ] };
    expect(roundTrickWinner(trick, 'always-the-bridesmaid')).toBe('c');
    expect(roundTrickWinner({ ...trick, plays: [trick.plays[0], { uid: 'b', card: { suit: 'pets' as const, rank: 12 } }, { uid: 'c', card: { suit: 'queens' as const, rank: 11 } }] }, 'always-the-bridesmaid')).toBe('a');
  });

  it('awards Sisterhood to the value farthest from the lead and compares all cards when followers are void', () => {
    const followed = { leaderUid: 'a', plays: [
      { uid: 'a', card: { suit: 'fairies' as const, rank: 6 } },
      { uid: 'b', card: { suit: 'fairies' as const, rank: 2 } },
      { uid: 'c', card: { suit: 'fairies' as const, rank: 10 } }
    ] };
    expect(roundTrickWinner(followed, 'sisterhood')).toBe('c');
    expect(roundTrickWinner({ ...followed, plays: [followed.plays[0], { uid: 'b', card: { suit: 'pets' as const, rank: 1 } }, { uid: 'c', card: { suit: 'queens' as const, rank: 12 } }] }, 'sisterhood')).toBe('c');
  });

  it('awards Poisoned Apple to the highest void card and keeps the first equal value', () => {
    const trick = { leaderUid: 'a', plays: [
      { uid: 'a', card: { suit: 'fairies' as const, rank: 12 } },
      { uid: 'b', card: { suit: 'pets' as const, rank: 5 } },
      { uid: 'c', card: { suit: 'queens' as const, rank: 5 } }
    ] };
    expect(roundTrickWinner(trick, 'poisoned-apple')).toBe('b');
    expect(roundTrickWinner({ ...trick, plays: [trick.plays[0], trick.plays[1], { uid: 'c', card: { suit: 'queens' as const, rank: 8 } }] }, 'poisoned-apple')).toBe('c');
  });
  it('sums two leading-suit cards and breaks Rings Twice ties with the highest card', () => {
    const trick = { leaderUid: 'a', plays: [
      { uid: 'a', card: { suit: 'fairies' as const, rank: 2 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 6 } }, { uid: 'c', card: { suit: 'pets' as const, rank: 12 } },
      { uid: 'a', card: { suit: 'fairies' as const, rank: 8 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 4 } }, { uid: 'c', card: { suit: 'fairies' as const, rank: 9 } }
    ] };
    expect(cardsPerTrick('prince-rings-twice')).toBe(2);
    expect(roundTrickWinner(trick, 'prince-rings-twice')).toBe('a');
  });
  it('counts Midnight Makeover Fairies in the leading suit and gives equal values to the latest play', () => {
    const trick = { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'queens' as const, rank: 8 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 8 } }, { uid: 'c', card: { suit: 'queens' as const, rank: 7 } }] };
    expect(roundTrickWinner(trick, 'midnight-makeover')).toBe('b');
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

  it('subtracts one proposal for every captured Fairy under Single Fairy', () => {
    expect(roundCardScore([{ suit: 'fairies', rank: 2 }, { suit: 'fairies', rank: 9 }, { suit: 'princes', rank: 4 }], 'single-fairy'))
      .toEqual({ princes: 1, frog: 0, roundRule: -2, total: -1 });
  });
  it('doubles Bathroom Break Princes except for a current high-score player', () => {
    const cards = [{ suit: 'princes' as const, rank: 2 }, { suit: 'princes' as const, rank: 9 }];
    expect(roundCardScore(cards, 'bathroom-break')).toEqual({ princes: 2, frog: 0, roundRule: 2, total: 4 });
    expect(roundCardScore(cards, 'bathroom-break', true)).toEqual({ princes: 2, frog: 0, roundRule: 0, total: 2 });
  });
  it('pairs Dancing Queens by exact rank before unmatched couples', () => {
    const cards = [
      { suit: 'princes' as const, rank: 2 }, { suit: 'princes' as const, rank: 7 }, { suit: 'princes' as const, rank: 9 },
      { suit: 'queens' as const, rank: 2 }, { suit: 'queens' as const, rank: 5 }
    ];
    expect(roundCardScore(cards, 'dancing-queens')).toEqual({ princes: 3, frog: 0, roundRule: 3, total: 6 });
  });
  it('overrides all scoring with Rebel of the Ball except during Wedding Gift', () => {
    const cards = [...Array.from({ length: 9 }, (_, index) => ({ suit: 'princes' as const, rank: index + 2 })), { suit: 'pets' as const, rank: 8 }, { suit: 'pets' as const, rank: 2 }];
    expect(roundCardScore(cards, 'pets-revenge', false, 9)).toEqual({ princes: 9, frog: 5, roundRule: -24, total: -10 });
    expect(roundCardScore(cards, 'wedding-gift', false, 9).total).toBe(14);
  });

  it('hides a Masquerade follower only until the trick is complete', () => {
    const partial = { leaderUid: 'a', plays: [{ uid: 'a', card: { suit: 'fairies' as const, rank: 2 } }, { uid: 'b', card: { suit: 'fairies' as const, rank: 3 } }] };
    expect(isMasqueradeHidden('masquerade-ball', partial, 'b', 3)).toBe(true);
    expect(isMasqueradeHidden('once-upon-a-time', partial, 'b', 3)).toBe(false);
  });
});
