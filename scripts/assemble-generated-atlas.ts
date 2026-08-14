import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

type FrameName = 'fairy' | 'queen' | 'prince' | 'princess' | 'round';

type Options = {
  out: string;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  frame: FrameName;
  sources: string[];
};

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  const separator = args.indexOf('--');
  const optionArgs = separator >= 0 ? args.slice(0, separator) : args;
  const sources = (separator >= 0 ? args.slice(separator + 1) : []).map((source) => resolve(source));

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
  if (!['fairy', 'queen', 'prince', 'princess', 'round'].includes(frame)) throw new Error(`Unknown --frame ${frame}`);
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
  const file = Bun.file(source);
  if (!(await file.exists())) throw new Error(`Missing source image: ${source}`);
  return `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
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
    const loaded = await Promise.all(images.map(load));

    const drawCover = (target: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, targetWidth: number, targetHeight: number) => {
      const sourceAspect = image.naturalWidth / image.naturalHeight;
      const targetAspect = targetWidth / targetHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;
      if (sourceAspect > targetAspect) {
        sourceWidth = image.naturalHeight * targetAspect;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = image.naturalWidth / targetAspect;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }
      target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, targetWidth, targetHeight);
    };

    const palette = {
      fairy: { outer: '#3f250b', middle: '#b9791f', light: '#f1cd70', shadow: '#181006' },
      queen: { outer: '#2b101d', middle: '#9f466c', light: '#ef9db7', shadow: '#150911' },
      prince: { outer: '#06182e', middle: '#a98345', light: '#ecd393', shadow: '#020b16' },
      princess: { outer: '#f3ead6', middle: '#8a806b', light: '#fffaf0', shadow: '#4c463a' },
      round: { outer: '#dbc07d', middle: '#9b6818', light: '#f8e8ac', shadow: '#442805' }
    }[options.frame];
    const scale = Math.min(options.cellWidth / 300, options.cellHeight / 500);
    const band = options.frame === 'round'
      ? Math.max(8, Math.round(Math.min(options.cellWidth, options.cellHeight) * 0.045))
      : Math.max(12, Math.round(14 * scale));
    const radius = Math.max(5, Math.round(9 * scale));

    const pathRect = (target: CanvasRenderingContext2D, cellWidth: number, cellHeight: number, inset: number) => {
      target.beginPath();
      target.roundRect(inset, inset, cellWidth - inset * 2, cellHeight - inset * 2, Math.max(2, radius - inset / 2));
    };
    const strokeRect = (target: CanvasRenderingContext2D, cellWidth: number, cellHeight: number, inset: number, color: string, lineWidth: number) => {
      pathRect(target, cellWidth, cellHeight, inset);
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
      target.fillStyle = palette.outer;
      target.fill();
      target.strokeStyle = palette.light;
      target.lineWidth = Math.max(1, Math.round(scale));
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
      drawCover(
        cardContext,
        loaded[index],
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
      strokeRect(cardContext, options.cellWidth, options.cellHeight, Math.max(6, Math.round(band * 0.48)), palette.light, Math.max(1, Math.round(scale)));
      strokeRect(cardContext, options.cellWidth, options.cellHeight, band - 1, palette.shadow, Math.max(2, Math.round(2 * scale)));

      const corner = Math.max(8, Math.round(band * 0.78));
      cardContext.strokeStyle = palette.light;
      cardContext.lineWidth = Math.max(1, Math.round(scale));
      for (const [cornerX, cornerY, directionX, directionY] of [
        [band, band, 1, 1],
        [options.cellWidth - band, band, -1, 1],
        [band, options.cellHeight - band, 1, -1],
        [options.cellWidth - band, options.cellHeight - band, -1, -1]
      ] as const) {
        cardContext.beginPath();
        cardContext.moveTo(cornerX, cornerY + directionY * corner);
        cardContext.lineTo(cornerX, cornerY);
        cardContext.lineTo(cornerX + directionX * corner, cornerY);
        cardContext.stroke();
        cardContext.beginPath();
        cardContext.moveTo(cornerX, cornerY + directionY * corner * 0.7);
        cardContext.lineTo(cornerX + directionX * corner * 0.7, cornerY);
        cardContext.stroke();
      }

      if (options.frame !== 'round') {
        const diamondSize = Math.max(4, Math.round(band * 0.48));
        drawDiamond(cardContext, options.cellWidth / 2, band / 2, diamondSize);
        drawDiamond(cardContext, options.cellWidth / 2, options.cellHeight - band / 2, diamondSize);
      } else {
        cardContext.beginPath();
        cardContext.ellipse(options.cellWidth / 2, options.cellHeight / 2, options.cellWidth / 2 - band, options.cellHeight / 2 - band, 0, 0, Math.PI * 2);
        cardContext.strokeStyle = palette.light;
        cardContext.lineWidth = Math.max(2, Math.round(band * 0.18));
        cardContext.stroke();
      }
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
