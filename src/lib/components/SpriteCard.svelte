<script lang="ts">
  import { spriteCell, spriteRect, type SpriteFit, type SpriteRect } from '$lib/sprite-crop';

  export let src: string;
  export let cols: number;
  export let rows: number;
  export let sheetWidth: number;
  export let sheetHeight: number;
  export let col: number;
  export let row: number;
  export let targetAspect: number | undefined = undefined;
  export let fit: SpriteFit = 'contain';
  export let crop: SpriteRect | undefined = undefined;
  export let style: string = '';

  $: cell = crop ? spriteRect(sheetWidth, sheetHeight, crop) : spriteCell(sheetWidth, sheetHeight, cols, rows, col, row);
  $: frameAspect = targetAspect ?? cell.aspect;
  $: preserveAspectRatio = fit === 'stretch' ? 'none' : `xMidYMid ${fit === 'cover' ? 'slice' : 'meet'}`;
</script>

<svg
  class="card-art"
  viewBox={cell.viewBox}
  {preserveAspectRatio}
  aria-hidden="true"
  focusable="false"
  data-cell={`${cell.x},${cell.y},${cell.width},${cell.height}`}
  data-frame-aspect={frameAspect.toFixed(5)}
  data-fit={fit}
  style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; {style}"
>
  <image href={src} x="0" y="0" width={sheetWidth} height={sheetHeight} preserveAspectRatio="none" />
</svg>
