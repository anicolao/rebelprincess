import { describe, expect, it } from 'vitest';
import { deterministicCards, exchangeCards, redistributeCards, returnedTrickCards } from './interactive-princess-powers';

const cards = [{ suit: 'fairies' as const, rank: 2 }, { suit: 'queens' as const, rank: 4 }, { suit: 'pets' as const, rank: 7 }];

describe('interactive Princess powers', () => {
  it('selects stable random cards for the Ice Princess and Scheherazade', () => {
    expect(deterministicCards(cards, 'fixed', 2)).toEqual(deterministicCards(cards, 'fixed', 2));
    expect(new Set(deterministicCards(cards, 'fixed', 2)).size).toBe(2);
  });

  it('conserves hands during Scheherazade exchange and Sleeping Beauty redistribution', () => {
    const exchanged = exchangeCards(cards.slice(0, 2), [cards[2]], cards[2], cards[0]);
    expect(exchanged.actor).toContainEqual(cards[2]); expect(exchanged.target).toContainEqual(cards[0]);
    const redistributed = redistributeCards({ a: [], b: [] }, ['a', 'b'], cards.slice(0, 2));
    expect(redistributed).toEqual({ a: [cards[0]], b: [cards[1]] });
  });

  it('returns Alice’s complete Frog-free trick and rejects a trick containing the Frog', () => {
    const plays = cards.map((card, index) => ({ uid: String(index), card }));
    expect(returnedTrickCards(plays, 3, 'alice')).toHaveLength(3);
    expect(returnedTrickCards([...plays.slice(0, 2), { uid: '2', card: { suit: 'pets', rank: 8 } }], 3, 'alice')).toEqual([]);
  });
});
