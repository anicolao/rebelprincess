import { describe, expect, it } from 'vitest';
import { assetAtlases, atlasCell, atlasFrameAspect, atlasSpriteProps } from './asset-sprites';

const atlas = (id: string) => assetAtlases.find((candidate) => candidate.id === id)!;

describe('asset atlas crop maps', () => {
  it('fills the canonical gameplay frame for every alternate suit', () => {
    for (const id of ['cards-fairies', 'cards-queens', 'cards-princes', 'cards-pets']) {
      expect(atlasSpriteProps(atlas(id), 0)).toMatchObject({ fit: 'stretch', targetAspect: 3 / 5 });
    }
  });

  it('uses native source proportions for the original suit-family review', () => {
    expect(atlasFrameAspect(atlas('suit-families'), 0)).toBe(429 / 916);
    expect(atlasFrameAspect(atlas('suit-families'), 1)).toBe(430 / 916);
  });

  it('excludes the nonuniform white gutters from original Princess portraits', () => {
    expect(atlasCell(atlas('princesses'), 0)).toMatchObject({ x: 6, y: 5, width: 312, height: 504 });
    expect(atlasCell(atlas('princesses'), 9)).toMatchObject({ x: 1219, y: 516, width: 309, height: 499 });
  });

  it('excludes the nonuniform cream gutters from original Round cards', () => {
    expect(atlasCell(atlas('rounds'), 0)).toMatchObject({ x: 7, y: 7, width: 243, height: 263 });
    expect(atlasCell(atlas('rounds'), 20)).toMatchObject({ x: 1525, y: 580, width: 243, height: 276 });
  });

  it('leaves both accepted Deluxe atlases on their original grid and contain fit', () => {
    expect(atlasSpriteProps(atlas('princesses-deluxe'), 1)).toMatchObject({ fit: 'contain', crop: undefined });
    expect(atlasSpriteProps(atlas('rounds-deluxe'), 5)).toMatchObject({ fit: 'contain', crop: undefined });
  });
});
