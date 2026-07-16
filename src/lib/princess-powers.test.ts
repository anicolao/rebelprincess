import { describe, expect, it } from 'vitest';
import { legalCardsWithPeaPower, mulanReplacements, snowWhiteCanZero, thumbelinaCanPlay } from './princess-powers';
import type { Card } from './setup';

const card = (suit: Card['suit'], rank: number): Card => ({ suit, rank });

describe('direct Princess powers', () => {
  it('limits Snow White to cards at seven or below', () => {
    expect(snowWhiteCanZero(card('queens', 7))).toBe(true);
    expect(snowWhiteCanZero(card('queens', 8))).toBe(false);
  });

  it('makes a player choose above five only from otherwise legal cards', () => {
    const trick = { leaderUid: 'a', plays: [{ uid: 'a', card: card('fairies', 4) }] };
    expect(legalCardsWithPeaPower([card('fairies', 3), card('fairies', 8), card('pets', 9)], trick, false, true)).toEqual([card('fairies', 8)]);
    expect(legalCardsWithPeaPower([card('fairies', 3), card('pets', 9)], trick, false, true)).toEqual([card('fairies', 3)]);
  });

  it('lets Mulan swap the same suit but never the Frog', () => {
    const hand = [card('queens', 2), card('queens', 8), card('pets', 4)];
    expect(mulanReplacements(hand, { uid: 'a', card: card('queens', 5) })).toEqual(hand.slice(0, 2));
    expect(mulanReplacements(hand, { uid: 'a', card: card('pets', 8) })).toEqual([]);
  });

  it('lets Thumbelina ignore suit with any card except a Prince or the Frog', () => {
    expect(thumbelinaCanPlay(card('fairies', 2))).toBe(true);
    expect(thumbelinaCanPlay(card('pets', 7))).toBe(true);
    expect(thumbelinaCanPlay(card('pets', 8))).toBe(false);
    expect(thumbelinaCanPlay(card('princes', 2))).toBe(false);
  });
});
