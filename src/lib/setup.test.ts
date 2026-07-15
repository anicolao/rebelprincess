import { describe, expect, it } from 'vitest';
import { cardLabel, dealForPlayers, deckForPlayers, ROUND_RULES, ROUND_RULE_TEXT } from './setup';

describe('deterministic setup', () => {
  it.each([[3, 36], [4, 40], [5, 40], [6, 48]])('builds the %i-player deck', (players, cards) => {
    expect(deckForPlayers(players)).toHaveLength(cards);
  });

  it('deals every card exactly once and repeats for the same seed', () => {
    const first = dealForPlayers(['host', 'guest', 'third'], 'fixed-003');
    expect(dealForPlayers(['host', 'guest', 'third'], 'fixed-003')).toEqual(first);
    expect(Object.values(first).flat()).toHaveLength(36);
    expect(new Set(Object.values(first).flat().map(cardLabel))).toHaveLength(36);
    expect(Object.values(first).map((hand) => hand.length)).toEqual([12, 12, 12]);
  });

  it('provides visible rules text for every round card', () => {
    expect(ROUND_RULES.map(([id]) => ROUND_RULE_TEXT[id]).every(Boolean)).toBe(true);
  });
});
