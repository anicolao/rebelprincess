<script lang="ts">
  export let src: string;
  export let cols: number;
  export let rows: number;
  export let sheetWidth: number;
  export let sheetHeight: number;
  export let col: number;
  export let row: number;
  export let targetAspect: number | undefined = undefined;
  export let style: string = '';

  // Calculate cell aspect ratio
  $: cellAspect = (sheetWidth * rows) / (sheetHeight * cols);

  // Use target aspect ratio if provided, otherwise cell aspect ratio
  $: activeAspect = targetAspect !== undefined ? targetAspect : cellAspect;

  $: bgSizeWidth = 0;
  $: bgSizeHeight = 0;
  $: xPercent = 0;
  $: yPercent = 0;

  $: {
    if (Math.abs(cellAspect - activeAspect) < 0.001) {
      bgSizeWidth = cols * 100;
      bgSizeHeight = rows * 100;
      xPercent = cols > 1 ? (col * 100) / (cols - 1) : 0;
      yPercent = rows > 1 ? (row * 100) / (rows - 1) : 0;
    } else if (cellAspect > activeAspect) {
      // Cell is wider than container, match height and crop sides
      const colScale = cellAspect / activeAspect;
      bgSizeWidth = cols * colScale * 100;
      bgSizeHeight = rows * 100;
      xPercent = (-col * colScale + 0.5 - 0.5 * colScale) / (1 - cols * colScale) * 100;
      yPercent = rows > 1 ? (row * 100) / (rows - 1) : 0;
    } else {
      // Cell is taller than container, match width and crop top/bottom
      const rowScale = activeAspect / cellAspect;
      bgSizeWidth = cols * 100;
      bgSizeHeight = rows * rowScale * 100;
      xPercent = cols > 1 ? (col * 100) / (cols - 1) : 0;
      yPercent = (-row * rowScale + 0.5 - 0.5 * rowScale) / (1 - rows * rowScale) * 100;
    }
  }

  $: spriteStyle = `background-image: url(${src}); background-size: ${bgSizeWidth.toFixed(2)}% ${bgSizeHeight.toFixed(2)}%; background-position: ${xPercent.toFixed(2)}% ${yPercent.toFixed(2)}%; background-repeat: no-repeat;`;
</script>

<div
  class="card-art"
  style="position: absolute; inset: 0; pointer-events: none; {spriteStyle} {style}"
></div>
