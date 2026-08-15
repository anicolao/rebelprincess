import { describe, expect, it } from 'vitest';
import { assetAtlases, atlasCell, atlasFrameAspect, atlasSpriteProps } from './asset-sprites';

const atlas = (id: string) => assetAtlases.find((candidate) => candidate.id === id)!;

describe('asset atlas crop maps', () => {
  it('uses one regular-grid crop path for every atlas', () => {
    for (const candidate of assetAtlases) {
      expect(candidate).not.toHaveProperty('crops');
      expect(candidate).not.toHaveProperty('fit');
      expect(atlasSpriteProps(candidate, 0)).not.toHaveProperty('crop');
      expect(atlasSpriteProps(candidate, 0)).not.toHaveProperty('fit');
    }
  });

  it('builds exact 3:5 cells for every suit and the unified Princess atlas', () => {
    for (const id of ['cards-fairies', 'cards-queens', 'cards-princes', 'cards-pets']) {
      expect(atlasCell(atlas(id), 0)).toMatchObject({ x: 0, y: 0, width: 300, height: 500, aspect: 3 / 5 });
      expect(atlasCell(atlas(id), 11)).toMatchObject({ x: 1500, y: 500, width: 300, height: 500, aspect: 3 / 5 });
    }
    expect(atlasCell(atlas('suit-families'), 3)).toMatchObject({ x: 900, y: 0, width: 300, height: 500, aspect: 3 / 5 });
    expect(atlasCell(atlas('princesses'), 11)).toMatchObject({ x: 1500, y: 500, width: 300, height: 500, aspect: 3 / 5 });
  });

  it('builds exact square cells for the unified Round atlas', () => {
    expect(atlasCell(atlas('rounds'), 0)).toMatchObject({ x: 0, y: 0, width: 300, height: 300, aspect: 1 });
    expect(atlasCell(atlas('rounds'), 26)).toMatchObject({ x: 2400, y: 600, width: 300, height: 300, aspect: 1 });
  });

  it('uses each atlas cell aspect as its display frame', () => {
    for (const candidate of assetAtlases) {
      expect(atlasFrameAspect(candidate)).toBe(atlasCell(candidate, 0).aspect);
    }
  });
});
