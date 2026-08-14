import { expect, test, type Locator, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const atlases = [
  { button: 'Fairy cards 12 cells', name: 'Fairy cards', id: 'fairy-crops', grid: '6x2', count: 12, first: '0,0 · 300×500', last: '1500,500 · 300×500', frameBand: 14 },
  { button: 'Queen cards 12 cells', name: 'Queen cards', id: 'queen-crops', grid: '6x2', count: 12, first: '0,0 · 300×500', last: '1500,500 · 300×500', frameBand: 14 },
  { button: 'Prince cards 12 cells', name: 'Prince cards', id: 'prince-crops', grid: '6x2', count: 12, first: '0,0 · 300×500', last: '1500,500 · 300×500', frameBand: 14 },
  { button: 'Pet cards 12 cells', name: 'Pet cards', id: 'pet-crops', grid: '6x2', count: 12, first: '0,0 · 300×500', last: '1500,500 · 300×500' },
  { button: 'Original suit families 4 cells', name: 'Original suit families', id: 'family-crops', grid: '4x1', count: 4, first: '0,0 · 300×500', last: '900,0 · 300×500' },
  { button: 'Princesses 10 cells', name: 'Princesses', id: 'princess-crops', grid: '5x2', count: 10, first: '0,0 · 300×500', last: '1200,500 · 300×500' },
  { button: 'Deluxe Princesses 2 cells', name: 'Deluxe Princesses', id: 'deluxe-princess-crops', grid: '2x1', count: 2, first: '0,0 · 600×1000', last: '600,0 · 600×1000', frameBand: 28 },
  { button: 'Round cards 21 cells', name: 'Round cards', id: 'round-crops', grid: '7x3', count: 21, first: '0,0 · 240×280', last: '1440,560 · 240×280', frameBand: 11 },
  { button: 'Deluxe Round cards 6 cells', name: 'Deluxe Round cards', id: 'deluxe-round-crops', grid: '3x2', count: 6, first: '0,0 · 500×500', last: '1000,500 · 500×500', frameBand: 23 }
] as const;

async function frameSignatures(page: Page, crops: Locator, band: number): Promise<string[]> {
  const art = crops.locator('.card-art');
  const href = await art.first().locator('image').getAttribute('href');
  const cells = await art.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-cell')!.split(',').map(Number)));
  return page.evaluate(async ({ href, cells, band }) => {
    const response = await fetch(href!);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const hash = (values: Uint8ClampedArray) => {
      let result = 2166136261;
      for (const value of values) {
        result ^= value;
        result = Math.imul(result, 16777619);
      }
      return result >>> 0;
    };
    return cells.map(([x, y, width, height]) => [
      hash(context.getImageData(x, y, width, band).data),
      hash(context.getImageData(x + width - band, y, band, height).data),
      hash(context.getImageData(x, y + height - band, width, band).data),
      hash(context.getImageData(x, y, band, height).data)
    ].join(':'));
  }, { href, cells, band });
}

test('asset review exposes every regenerated atlas through one uniform grid renderer', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Asset review', 'Review all nine regenerated atlases and verify that every sprite uses the same exact regular-grid crop path.');

  await page.goto('/assets/');
  await expect(page).toHaveURL(/\/assets\/$/);
  await expect(page.getByRole('navigation', { name: 'Asset atlases' }).getByRole('button')).toHaveCount(9);
  await expect(page.getByRole('status')).toContainText('91 sprites');

  for (const atlas of atlases) {
    await page.getByRole('button', { name: atlas.button, exact: true }).click();
    const crops = page.getByLabel(`${atlas.name} computed crops`);
    await steps.step(atlas.id, {
      description: `${atlas.name} uses a complete edge-to-edge ${atlas.grid.replace('x', ' × ')} uniform grid`,
      verifications: [
        { spec: `All ${atlas.count} sprites are rendered`, check: async () => expect(crops.locator('.crop-card')).toHaveCount(atlas.count) },
        { spec: `Every sprite uses the shared ${atlas.grid} grid renderer`, check: async () => expect(crops.locator(`.card-art[data-grid="${atlas.grid}"]`)).toHaveCount(atlas.count) },
        { spec: 'The first crop starts at the source origin', check: async () => expect(page.getByText(atlas.first, { exact: true })).toBeVisible() },
        { spec: 'The final crop reaches the source bottom-right edge', check: async () => expect(page.getByText(atlas.last, { exact: true })).toBeVisible() },
        ...('frameBand' in atlas ? [{
          spec: `Every card has the same ${atlas.frameBand}px frame on all four edges`,
          check: async () => expect(new Set(await frameSignatures(page, crops, atlas.frameBand)).size).toBe(1)
        }] : [])
      ]
    });
  }

  steps.generateDocs();
});
