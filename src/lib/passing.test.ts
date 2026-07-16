import { describe, expect, it } from 'vitest';
import { passInstruction, resolvePasses, type PassDirection } from './passing';
import { cardLabel, type Card } from './setup';

const card = (rank: number): Card => ({ suit: 'fairies', rank });
const hands = { a: [card(2), card(3), card(4)], b: [card(5), card(6), card(7)], c: [card(8), card(9), card(10)] };

describe('simultaneous passing', () => {
  it.each([
    ['once-upon-a-time', 'right', 3],
    ['late-to-the-ball', 'right', 1],
    ['magic-beans', 'left', 3],
    ['three-times-a-lady', 'right', 3],
    ['arranged-marriage', 'split', 2],
    ['royal-decree', 'right', 3],
    ['always-the-bridesmaid', 'right', 1],
    ['crystal-clear', 'right', 2],
    ['masquerade-ball', 'left', 1],
    ['pets-revenge', 'split', 2]
  ] as const)('uses %s’s printed pass', (roundId, direction, count) => {
    expect(passInstruction(roundId)).toEqual({ direction, count });
  });

  it.each([
    ['left', { a: [2, 3, 8], b: [4, 5, 6], c: [7, 9, 10] }],
    ['right', { a: [2, 3, 7], b: [5, 6, 8], c: [4, 9, 10] }]
  ] as const)('resolves %s passes by seat', (direction, expected) => {
    const result = resolvePasses(['a', 'b', 'c'], hands, { a: [card(4)], b: [card(7)], c: [card(8)] }, { direction: direction as PassDirection, count: 1 });
    expect(Object.fromEntries(Object.entries(result).map(([uid, cards]) => [uid, cards.map(({ rank }) => rank)]))).toEqual(expected);
  });

  it('splits cards left then right and conserves the complete deck', () => {
    const result = resolvePasses(['a', 'b', 'c'], hands, { a: [card(2), card(3)], b: [card(5), card(6)], c: [card(8), card(9)] }, { direction: 'split', count: 2 });
    expect(result.a.map(({ rank }) => rank)).toEqual([4, 6, 8]);
    expect(new Set(Object.values(result).flat().map(cardLabel))).toEqual(new Set(Object.values(hands).flat().map(cardLabel)));
  });

  it('rejects incomplete and impossible submissions', () => {
    expect(() => resolvePasses(['a', 'b', 'c'], hands, { a: [card(2)], b: [card(5)], c: [] }, { direction: 'left', count: 1 })).toThrow();
    expect(() => resolvePasses(['a', 'b', 'c'], hands, { a: [card(12)], b: [card(5)], c: [card(8)] }, { direction: 'left', count: 1 })).toThrow();
  });
});
