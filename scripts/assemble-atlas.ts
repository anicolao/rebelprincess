import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

type FrameName = 'fairy' | 'queen' | 'prince' | 'pet' | 'princess' | 'round' | 'family';

type Source = {
  path: string;
  cols: number;
  rows: number;
  index: number;
  inset: number;
};

type Options = {
  out: string;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  frame: FrameName;
  sources: Source[];
};

function parseSource(value: string): Source {
  const [path, cols = '1', rows = '1', index = '0', inset = '0'] = value.split('::');
  const source = {
    path: resolve(path),
    cols: Number(cols),
    rows: Number(rows),
    index: Number(index),
    inset: Number(inset)
  };
  if (![source.cols, source.rows].every((number) => Number.isInteger(number) && number > 0)) {
    throw new Error(`Invalid source grid: ${value}`);
  }
  if (!Number.isInteger(source.index) || source.index < 0 || source.index >= source.cols * source.rows) {
    throw new Error(`Invalid source index: ${value}`);
  }
  if (!Number.isInteger(source.inset) || source.inset < 0) throw new Error(`Invalid source inset: ${value}`);
  return source;
}

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  const separator = args.indexOf('--');
  const optionArgs = separator >= 0 ? args.slice(0, separator) : args;
  const sources = (separator >= 0 ? args.slice(separator + 1) : []).map(parseSource);

  for (let index = 0; index < optionArgs.length; index += 2) {
    const key = optionArgs[index];
    const value = optionArgs[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid option near ${key ?? '(end)'}`);
    values.set(key.slice(2), value);
  }

  const number = (key: string) => {
    const value = Number(values.get(key));
    if (!Number.isInteger(value) || value <= 0) throw new Error(`--${key} must be a positive integer`);
    return value;
  };
  const frame = values.get('frame') as FrameName;
  if (!['fairy', 'queen', 'prince', 'pet', 'princess', 'round', 'family'].includes(frame)) throw new Error(`Unknown --frame ${frame}`);
  const out = values.get('out');
  if (!out) throw new Error('--out is required');

  const options = {
    out: resolve(out),
    cols: number('cols'),
    rows: number('rows'),
    cellWidth: number('cell-width'),
    cellHeight: number('cell-height'),
    frame,
    sources
  };
  if (sources.length !== options.cols * options.rows) {
    throw new Error(`Expected ${options.cols * options.rows} sources, received ${sources.length}`);
  }
  return options;
}

const options = parseOptions(Bun.argv.slice(2));
const images = await Promise.all(options.sources.map(async (source) => {
  const file = Bun.file(source.path);
  if (!(await file.exists())) throw new Error(`Missing source image: ${source.path}`);
  return {
    ...source,
    dataUrl: `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
  };
}));

const width = options.cols * options.cellWidth;
const height = options.rows * options.cellHeight;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent('<canvas></canvas>');
  const validation = await page.evaluate(async ({ images, options }) => {
    const canvas = document.querySelector('canvas')!;
    canvas.width = options.cols * options.cellWidth;
    canvas.height = options.rows * options.cellHeight;
    canvas.style.display = 'block';
    const context = canvas.getContext('2d', { alpha: false })!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
    const loaded = await Promise.all(images.map(async (source) => ({ ...source, image: await load(source.dataUrl) })));

    const drawCover = (
      target: CanvasRenderingContext2D,
      image: HTMLImageElement,
      sourceX: number,
      sourceY: number,
      sourceWidth: number,
      sourceHeight: number,
      x: number,
      y: number,
      targetWidth: number,
      targetHeight: number
    ) => {
      const sourceAspect = sourceWidth / sourceHeight;
      const targetAspect = targetWidth / targetHeight;
      if (sourceAspect > targetAspect) {
        const croppedWidth = sourceHeight * targetAspect;
        sourceX += (sourceWidth - croppedWidth) / 2;
        sourceWidth = croppedWidth;
      } else {
        const croppedHeight = sourceWidth / targetAspect;
        sourceY += (sourceHeight - croppedHeight) / 2;
        sourceHeight = croppedHeight;
      }
      target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, targetWidth, targetHeight);
    };

    const palette = {
      fairy: { outer: '#3b2608', middle: '#b47a08', light: '#f4c62e', shadow: '#160e03' },
      queen: { outer: '#35101f', middle: '#b47a08', light: '#f4c62e', shadow: '#17070d' },
      prince: { outer: '#071d35', middle: '#b47a08', light: '#f4c62e', shadow: '#030c16' },
      pet: { outer: '#06291c', middle: '#b47a08', light: '#f4c62e', shadow: '#02130d' },
      princess: { outer: '#271530', middle: '#b47a08', light: '#f4c62e', shadow: '#100713' },
      round: { outer: '#31220d', middle: '#b47a08', light: '#f4c62e', shadow: '#140d04' },
      family: { outer: '#202025', middle: '#b47a08', light: '#f4c62e', shadow: '#0b0b0d' }
    }[options.frame];
    const scale = Math.min(options.cellWidth / 300, options.cellHeight / 500);
    const band = Math.max(16, Math.round(Math.min(options.cellWidth, options.cellHeight) * 0.067));

    const strokeRect = (target: CanvasRenderingContext2D, cellWidth: number, cellHeight: number, inset: number, color: string, lineWidth: number) => {
      target.beginPath();
      target.rect(inset, inset, cellWidth - inset * 2, cellHeight - inset * 2);
      target.strokeStyle = color;
      target.lineWidth = lineWidth;
      target.stroke();
    };
    const drawDiamond = (target: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) => {
      target.beginPath();
      target.moveTo(centerX, centerY - size);
      target.lineTo(centerX + size, centerY);
      target.lineTo(centerX, centerY + size);
      target.lineTo(centerX - size, centerY);
      target.closePath();
      target.fillStyle = palette.shadow;
      target.fill();
      target.strokeStyle = palette.middle;
      target.lineWidth = Math.max(2, Math.round(scale * 1.5));
      target.stroke();
      const pip = Math.max(1.5, size * 0.14);
      target.fillStyle = palette.light;
      for (const [offsetX, offsetY] of [[-pip * 1.8, 0], [0, -pip * 1.6], [pip * 1.8, 0], [0, pip * 1.8]] as const) {
        target.beginPath();
        target.arc(centerX + offsetX, centerY + offsetY, pip, 0, Math.PI * 2);
        target.fill();
      }
    };

    const drawCorner = (target: CanvasRenderingContext2D, cellWidth: number, cellHeight: number, right: boolean, bottom: boolean) => {
      const directionX = right ? -1 : 1;
      const directionY = bottom ? -1 : 1;
      const originX = right ? cellWidth - 5 : 5;
      const originY = bottom ? cellHeight - 5 : 5;
      const reach = Math.max(26, Math.round(Math.min(options.cellWidth, options.cellHeight) * 0.14));
      target.fillStyle = palette.shadow;
      target.beginPath();
      target.moveTo(originX, originY);
      target.lineTo(originX + directionX * reach, originY);
      target.lineTo(originX, originY + directionY * reach);
      target.closePath();
      target.fill();
      target.strokeStyle = palette.middle;
      target.lineWidth = Math.max(2, Math.round(scale * 1.5));
      target.stroke();
      target.strokeStyle = palette.light;
      target.lineWidth = Math.max(1, Math.round(scale));
      target.beginPath();
      target.moveTo(originX + directionX * reach * 0.32, originY);
      target.lineTo(originX + directionX * reach * 0.55, originY + directionY * reach * 0.23);
      target.lineTo(originX, originY + directionY * reach * 0.78);
      target.moveTo(originX, originY + directionY * reach * 0.32);
      target.lineTo(originX + directionX * reach * 0.23, originY + directionY * reach * 0.55);
      target.lineTo(originX + directionX * reach * 0.78, originY);
      target.stroke();
    };

    for (let index = 0; index < loaded.length; index++) {
      const col = index % options.cols;
      const row = Math.floor(index / options.cols);
      const x = col * options.cellWidth;
      const y = row * options.cellHeight;
      const card = document.createElement('canvas');
      card.width = options.cellWidth;
      card.height = options.cellHeight;
      const cardContext = card.getContext('2d', { alpha: false })!;
      cardContext.imageSmoothingEnabled = true;
      cardContext.imageSmoothingQuality = 'high';
      cardContext.fillStyle = palette.outer;
      cardContext.fillRect(0, 0, options.cellWidth, options.cellHeight);
      const source = loaded[index];
      const sourceCellWidth = source.image.naturalWidth / source.cols;
      const sourceCellHeight = source.image.naturalHeight / source.rows;
      const sourceCol = source.index % source.cols;
      const sourceRow = Math.floor(source.index / source.cols);
      drawCover(
        cardContext,
        source.image,
        sourceCol * sourceCellWidth + source.inset,
        sourceRow * sourceCellHeight + source.inset,
        sourceCellWidth - source.inset * 2,
        sourceCellHeight - source.inset * 2,
        band,
        band,
        options.cellWidth - band * 2,
        options.cellHeight - band * 2
      );
      cardContext.fillRect(0, 0, options.cellWidth, band);
      cardContext.fillRect(0, options.cellHeight - band, options.cellWidth, band);
      cardContext.fillRect(0, band, band, options.cellHeight - band * 2);
      cardContext.fillRect(options.cellWidth - band, band, band, options.cellHeight - band * 2);
      strokeRect(cardContext, options.cellWidth, options.cellHeight, 2, palette.middle, Math.max(2, Math.round(2 * scale)));
      strokeRect(cardContext, options.cellWidth, options.cellHeight, Math.max(6, Math.round(band * 0.42)), palette.light, Math.max(1, Math.round(scale)));
      strokeRect(cardContext, options.cellWidth, options.cellHeight, band - 1, palette.middle, Math.max(2, Math.round(2 * scale)));
      drawCorner(cardContext, options.cellWidth, options.cellHeight, false, false);
      drawCorner(cardContext, options.cellWidth, options.cellHeight, true, false);
      drawCorner(cardContext, options.cellWidth, options.cellHeight, false, true);
      drawCorner(cardContext, options.cellWidth, options.cellHeight, true, true);
      const diamondSize = Math.max(9, Math.round(band * 0.72));
      drawDiamond(cardContext, options.cellWidth / 2, band, diamondSize);
      drawDiamond(cardContext, options.cellWidth / 2, options.cellHeight - band, diamondSize);
      context.drawImage(card, x, y);
    }

    const hash = (values: Uint8ClampedArray) => {
      let result = 2166136261;
      for (const value of values) {
        result ^= value;
        result = Math.imul(result, 16777619);
      }
      return result >>> 0;
    };
    const signatures = loaded.map((_, index) => {
      const x = (index % options.cols) * options.cellWidth;
      const y = Math.floor(index / options.cols) * options.cellHeight;
      const top = context.getImageData(x, y, options.cellWidth, band).data;
      const bottom = context.getImageData(x, y + options.cellHeight - band, options.cellWidth, band).data;
      const left = context.getImageData(x, y, band, options.cellHeight).data;
      const right = context.getImageData(x + options.cellWidth - band, y, band, options.cellHeight).data;
      return [hash(top), hash(right), hash(bottom), hash(left)].join(':');
    });
    if (new Set(signatures).size !== 1) throw new Error(`Frame geometry differs: ${signatures.join(', ')}`);
    return { width: canvas.width, height: canvas.height, cellWidth: options.cellWidth, cellHeight: options.cellHeight, band, signature: signatures[0] };
  }, { images, options });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width !== width || box.height !== height) throw new Error(`Canvas is ${box?.width}×${box?.height}, expected ${width}×${height}`);
  await canvas.screenshot({ path: options.out, animations: 'disabled' });
  console.log(JSON.stringify({ out: options.out, frame: options.frame, sources: options.sources.length, ...validation }));
} finally {
  await browser.close();
}
