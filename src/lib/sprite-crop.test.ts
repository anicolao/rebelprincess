import { describe, expect, it } from 'vitest';
import { spriteCell, spriteRect } from './sprite-crop';

describe('spriteCell', () => {
  it('returns exact cells for evenly divisible sheets', () => {
    expect(spriteCell(1536, 1024, 2, 1, 1, 0)).toMatchObject({ x: 768, y: 0, width: 768, height: 1024, viewBox: '768 0 768 1024' });
  });

  it('distributes indivisible sheet pixels across shared integer edges', () => {
    const cells = Array.from({ length: 6 }, (_, col) => spriteCell(1651, 953, 6, 2, col, 0));
    expect(cells.map(({ x, width }) => [x, width])).toEqual([
      [0, 275], [275, 275], [550, 276], [826, 275], [1101, 275], [1376, 275]
    ]);
    expect(cells.at(-1)!.x + cells.at(-1)!.width).toBe(1651);
  });

  it('keeps rows contiguous through the final source pixel', () => {
    const first = spriteCell(1774, 887, 7, 3, 6, 0);
    const last = spriteCell(1774, 887, 7, 3, 6, 2);
    expect(first.x + first.width).toBe(1774);
    expect(last.y + last.height).toBe(887);
    expect(last.viewBox).toBe('1521 591 253 296');
  });

  it('rejects invalid grids and out-of-range cells', () => {
    expect(() => spriteCell(100, 100, 0, 1, 0, 0)).toThrow('positive integers');
    expect(() => spriteCell(100, 100, 2, 2, 2, 0)).toThrow('outside');
  });

  it('uses measured integer rectangles for atlases with gutters', () => {
    expect(spriteRect(1536, 1024, { x: 325, y: 5, width: 291, height: 504 })).toEqual({
      x: 325, y: 5, width: 291, height: 504, aspect: 291 / 504, viewBox: '325 5 291 504'
    });
  });

  it('rejects measured rectangles outside their atlas', () => {
    expect(() => spriteRect(100, 100, { x: 90, y: 0, width: 11, height: 10 })).toThrow('outside');
    expect(() => spriteRect(100, 100, { x: 0.5, y: 0, width: 10, height: 10 })).toThrow('integer pixels');
  });
});
