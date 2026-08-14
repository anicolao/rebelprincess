import fairiesAltAtlas from '../../assets/generated/alternate-suits-review/fairies.png';
import petsAltAtlas from '../../assets/generated/alternate-suits-review/pets.png';
import princesAltAtlas from '../../assets/generated/alternate-suits-review/princes.png';
import queensAltAtlas from '../../assets/generated/alternate-suits-review/queens.png';
import deluxePrincessAtlas from '../../assets/generated/princess-portraits-deluxe.png';
import princessAtlas from '../../assets/generated/princess-portraits.png';
import deluxeRoundAtlas from '../../assets/generated/round-rule-vignettes-deluxe.png';
import roundAtlas from '../../assets/generated/round-rule-vignettes.png';
import suitFamiliesAtlas from '../../assets/generated/suited-card-families.png';
import { PRINCESSES, type Card, type Suit } from './setup';
import { spriteCell, spriteRect, type SpriteCell, type SpriteFit, type SpriteRect } from './sprite-crop';

export type AssetCell = { id: string; name: string };

export type AssetAtlas = {
  id: string;
  name: string;
  description: string;
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  cols: number;
  rows: number;
  targetAspect: number | 'source';
  fit: SpriteFit;
  crops?: SpriteRect[];
  cells: AssetCell[];
};

const ranks = (suit: string): AssetCell[] => Array.from({ length: 12 }, (_, index) => ({
  id: `${suit}-${index + 1}`,
  name: `${suit[0].toUpperCase()}${suit.slice(1)} ${index + 1}`
}));

const alternateSuitAtlases: Record<Suit, AssetAtlas> = {
  fairies: { id: 'cards-fairies', name: 'Fairy cards', description: 'Ranks 1–12 · alternate gameplay art', src: fairiesAltAtlas, sheetWidth: 1651, sheetHeight: 953, cols: 6, rows: 2, targetAspect: 3 / 5, fit: 'stretch', cells: ranks('fairies') },
  queens: { id: 'cards-queens', name: 'Queen cards', description: 'Ranks 1–12 · alternate gameplay art', src: queensAltAtlas, sheetWidth: 1717, sheetHeight: 916, cols: 6, rows: 2, targetAspect: 3 / 5, fit: 'stretch', cells: ranks('queens') },
  princes: { id: 'cards-princes', name: 'Prince cards', description: 'Ranks 1–12 · alternate gameplay art', src: princesAltAtlas, sheetWidth: 1716, sheetHeight: 916, cols: 6, rows: 2, targetAspect: 3 / 5, fit: 'stretch', cells: ranks('princes') },
  pets: { id: 'cards-pets', name: 'Pet cards', description: 'Ranks 1–12 · alternate gameplay art', src: petsAltAtlas, sheetWidth: 1661, sheetHeight: 947, cols: 6, rows: 2, targetAspect: 3 / 5, fit: 'stretch', cells: ranks('pets') }
};

const princessColumns: SpriteRect[] = [
  { x: 6, y: 0, width: 312, height: 1 },
  { x: 325, y: 0, width: 291, height: 1 },
  { x: 622, y: 0, width: 292, height: 1 },
  { x: 921, y: 0, width: 292, height: 1 },
  { x: 1219, y: 0, width: 309, height: 1 }
];
const princessRows = [{ y: 5, height: 504 }, { y: 516, height: 499 }];
const princessCrops = princessRows.flatMap(({ y, height }) => princessColumns.map(({ x, width }) => ({ x, y, width, height })));

const roundColumns: SpriteRect[] = [
  { x: 7, y: 0, width: 243, height: 1 },
  { x: 261, y: 0, width: 243, height: 1 },
  { x: 516, y: 0, width: 243, height: 1 },
  { x: 769, y: 0, width: 237, height: 1 },
  { x: 1019, y: 0, width: 241, height: 1 },
  { x: 1276, y: 0, width: 238, height: 1 },
  { x: 1525, y: 0, width: 243, height: 1 }
];
const roundRows = [{ y: 7, height: 263 }, { y: 294, height: 262 }, { y: 580, height: 276 }];
const roundCrops = roundRows.flatMap(({ y, height }) => roundColumns.map(({ x, width }) => ({ x, y, width, height })));

const originalRoundIds = ['once-upon-a-time', 'invitation', 'masquerade-ball', 'royal-decree', 'musical-chairs', 'pets-revenge', 'late-to-the-ball', 'poisoned-apple', 'crystal-clear', 'upside-down', 'dancing-queens', 'prince-rings-twice', 'wedding-gift', 'after-party', 'bathroom-break', 'single-fairy', 'midnight-makeover', 'blind-mans-bluff', 'odds-and-evens', 'pass-the-bouquet', 'haggle-with-the-hag'] as const;
const originalRoundNames = ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs', 'Pets’ Revenge', 'Late to the Ball', 'Poisoned Apple', 'Crystal Clear', 'Upside Down', 'Dancing Queens', 'The Prince Always Rings Twice', 'Wedding Gift', 'After Party', 'Bathroom Break', 'Single Fairy', 'Midnight Makeover', 'Blind Man’s Bluff', 'Odds and Evens', 'Pass the Bouquet', 'Haggle with the Hag'] as const;
const deluxeRoundIds = ['magic-beans', 'three-times-a-lady', 'arranged-marriage', 'always-the-bridesmaid', 'sisterhood', 'late-for-a-very-important-date'] as const;
const deluxeRoundNames = ['Magic Beans', 'Three Times a Lady', 'Arranged Marriage', 'Always the Bridesmaid', 'Sisterhood', 'Late for a Very Important Date'] as const;

export const assetAtlases: AssetAtlas[] = [
  ...Object.values(alternateSuitAtlases),
  {
    id: 'suit-families', name: 'Original suit families', description: 'Original four-panel concept atlas', src: suitFamiliesAtlas,
    sheetWidth: 1717, sheetHeight: 916, cols: 4, rows: 1, targetAspect: 'source', fit: 'contain',
    cells: ['fairies', 'queens', 'princes', 'pets'].map((id) => ({ id: `family-${id}`, name: `${id[0].toUpperCase()}${id.slice(1)} family` }))
  },
  {
    id: 'princesses', name: 'Princesses', description: 'Ten original Princess portraits', src: princessAtlas,
    sheetWidth: 1536, sheetHeight: 1024, cols: 5, rows: 2, targetAspect: 3 / 5, fit: 'stretch', crops: princessCrops,
    cells: PRINCESSES.slice(0, 10).map(([id, name]) => ({ id, name }))
  },
  {
    id: 'princesses-deluxe', name: 'Deluxe Princesses', description: 'Rapunzel and Thumbelina extension', src: deluxePrincessAtlas,
    sheetWidth: 1536, sheetHeight: 1024, cols: 2, rows: 1, targetAspect: 3 / 5, fit: 'contain',
    cells: PRINCESSES.slice(10).map(([id, name]) => ({ id, name }))
  },
  {
    id: 'rounds', name: 'Round cards', description: 'Twenty-one original Round-rule vignettes', src: roundAtlas,
    sheetWidth: 1774, sheetHeight: 887, cols: 7, rows: 3, targetAspect: 6 / 7, fit: 'stretch', crops: roundCrops,
    cells: originalRoundIds.map((id, index) => ({ id, name: originalRoundNames[index] }))
  },
  {
    id: 'rounds-deluxe', name: 'Deluxe Round cards', description: 'Six square Deluxe vignettes', src: deluxeRoundAtlas,
    sheetWidth: 1536, sheetHeight: 1024, cols: 3, rows: 2, targetAspect: 1, fit: 'contain',
    cells: deluxeRoundIds.map((id, index) => ({ id, name: deluxeRoundNames[index] }))
  }
];

export function atlasCell(atlas: AssetAtlas, index: number): SpriteCell {
  const crop = atlas.crops?.[index];
  return crop
    ? spriteRect(atlas.sheetWidth, atlas.sheetHeight, crop)
    : spriteCell(atlas.sheetWidth, atlas.sheetHeight, atlas.cols, atlas.rows, index % atlas.cols, Math.floor(index / atlas.cols));
}

export function atlasFrameAspect(atlas: AssetAtlas, index: number): number {
  return atlas.targetAspect === 'source' ? atlasCell(atlas, index).aspect : atlas.targetAspect;
}

export function atlasSpriteProps(atlas: AssetAtlas, index: number) {
  return {
    src: atlas.src,
    sheetWidth: atlas.sheetWidth,
    sheetHeight: atlas.sheetHeight,
    cols: atlas.cols,
    rows: atlas.rows,
    col: index % atlas.cols,
    row: Math.floor(index / atlas.cols),
    targetAspect: atlasFrameAspect(atlas, index),
    fit: atlas.fit,
    crop: atlas.crops?.[index]
  };
}

export function cardSpriteProps(card: Card) {
  return atlasSpriteProps(alternateSuitAtlases[card.suit], card.rank - 1);
}

export function princessSpriteProps(id?: string) {
  const index = PRINCESSES.findIndex(([key]) => key === id);
  const atlas = assetAtlases.find(({ id: atlasId }) => atlasId === (index >= 10 ? 'princesses-deluxe' : 'princesses'))!;
  return atlasSpriteProps(atlas, index >= 10 ? index - 10 : Math.max(0, index));
}

export function roundSpriteProps(id: string) {
  const originalIndex = originalRoundIds.indexOf(id as typeof originalRoundIds[number]);
  const deluxeIndex = deluxeRoundIds.indexOf(id as typeof deluxeRoundIds[number]);
  const atlas = assetAtlases.find(({ id: atlasId }) => atlasId === (deluxeIndex >= 0 ? 'rounds-deluxe' : 'rounds'))!;
  return atlasSpriteProps(atlas, deluxeIndex >= 0 ? deluxeIndex : Math.max(0, originalIndex));
}

export function roundTargetAspect(id: string): number {
  return deluxeRoundIds.includes(id as typeof deluxeRoundIds[number]) ? 1 : 6 / 7;
}
