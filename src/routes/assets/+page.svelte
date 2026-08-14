<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { base } from '$app/paths';
  import { assetAtlases, atlasCell, atlasFrameAspect, atlasSpriteProps } from '$lib/asset-sprites';
  import SpriteCard from '$lib/components/SpriteCard.svelte';

  let selectedId = assetAtlases[0].id;
  $: selected = assetAtlases.find(({ id }) => id === selectedId) ?? assetAtlases[0];
</script>

<svelte:head>
  <title>Asset review — Rebel Princess</title>
  <meta name="description" content="Inspect every Rebel Princess atlas and exact sprite crop." />
</svelte:head>

<main data-e2e-layout>
  <header class="masthead">
    <a class="wordmark" href={`${base}/`} aria-label="Rebel Princess home"><span>Rebel</span><strong>Princess</strong></a>
    <a class="back-link" href={`${base}/`}>Back to game</a>
  </header>

  <section class="intro" aria-labelledby="asset-title">
    <div>
      <p class="eyebrow">Visual QA</p>
      <h1 id="asset-title">Asset review</h1>
      <p>Inspect each regenerated source atlas, its uniform pixel grid, and every in-game crop. Every sheet uses the same regular-grid renderer with complete borders inside each cell.</p>
    </div>
    <p class="review-status" role="status" data-status="synced"><strong>{assetAtlases.length}</strong> atlases · <strong>{assetAtlases.reduce((sum, atlas) => sum + atlas.cells.length, 0)}</strong> sprites</p>
  </section>

  <nav class="atlas-tabs" aria-label="Asset atlases">
    {#each assetAtlases as atlas}
      <button type="button" class:active={selected.id === atlas.id} aria-pressed={selected.id === atlas.id} on:click={() => selectedId = atlas.id}>
        <strong>{atlas.name}</strong><span>{atlas.cells.length} cells</span>
      </button>
    {/each}
  </nav>

  <section class="atlas-review" aria-labelledby="selected-atlas-name">
    <header class="atlas-heading">
      <div><p class="eyebrow">{selected.cols} × {selected.rows} atlas · uniform grid</p><h2 id="selected-atlas-name">{selected.name}</h2><p>{selected.description}</p></div>
      <dl>
        <div><dt>Source</dt><dd>{selected.sheetWidth} × {selected.sheetHeight}px</dd></div>
        <div><dt>Cell</dt><dd>{selected.targetAspect.toFixed(3)} aspect</dd></div>
        <div><dt>Render</dt><dd>edge to edge</dd></div>
      </dl>
    </header>

    <figure class="source-atlas">
      <div class="source-image">
        <img src={selected.src} alt={`${selected.name} source atlas`} width={selected.sheetWidth} height={selected.sheetHeight} />
        <div class="grid-overlay" aria-hidden="true">
          {#each selected.cells as _, index}
            {@const crop = atlasCell(selected, index)}
            <i style={`left:${crop.x / selected.sheetWidth * 100}%;top:${crop.y / selected.sheetHeight * 100}%;width:${crop.width / selected.sheetWidth * 100}%;height:${crop.height / selected.sheetHeight * 100}%`}></i>
          {/each}
        </div>
      </div>
      <figcaption>Source atlas with computed cell boundaries</figcaption>
    </figure>

    <div class="crop-grid" aria-label={`${selected.name} computed crops`}>
      {#each selected.cells as cell, index}
        {@const crop = atlasCell(selected, index)}
        {@const frameAspect = atlasFrameAspect(selected)}
        <article class="crop-card">
          <div class="crop-frame" style={`aspect-ratio: ${frameAspect}`}>
            <SpriteCard {...atlasSpriteProps(selected, index)} />
          </div>
          <div class="crop-copy">
            <strong>{cell.name}</strong>
            <code>{crop.x},{crop.y} · {crop.width}×{crop.height}</code>
            <span>source {crop.aspect.toFixed(3)} → frame {frameAspect.toFixed(3)}</span>
          </div>
        </article>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background: #140d1e; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(body) { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 76% 4%, rgba(149, 91, 184, .28), transparent 36rem), linear-gradient(145deg, #160e22 0%, #251638 48%, #101c24 100%); }
  :global(button), :global(a) { font: inherit; }
  main { width: min(1480px, calc(100% - clamp(28px, 5vw, 80px))); min-height: 100vh; margin: 0 auto; padding-bottom: 64px; }
  .masthead { min-height: 88px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 239, 199, .22); }
  .wordmark { display: flex; align-items: baseline; gap: 7px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 23px; text-decoration: none; }
  .wordmark strong { color: #ffc75f; font-size: 32px; }
  .back-link { padding: 8px 12px; border: 1px solid rgba(255, 226, 163, .35); border-radius: 999px; color: #fff4d0; text-decoration: none; }
  .intro { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 32px; padding: clamp(34px, 6vw, 74px) 0 32px; }
  .intro h1 { margin: 0; color: #fff5dc; font-family: 'Cormorant Garamond', serif; font-size: clamp(52px, 7vw, 92px); line-height: .86; }
  .intro > div > p:last-child { max-width: 760px; margin: 24px 0 0; color: #cfc4d4; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.5; }
  .eyebrow { margin: 0 0 8px; color: #ffc75f; font-size: 11px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
  .review-status { margin: 0; padding: 12px 16px; border: 1px solid rgba(125, 226, 167, .35); border-radius: 9px; color: #d8cfe0; background: rgba(20, 13, 30, .55); white-space: nowrap; }
  .review-status strong { color: #7de2a7; }
  .atlas-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 7px; margin-bottom: 22px; }
  .atlas-tabs button { min-height: 58px; padding: 9px 11px; border: 1px solid rgba(255, 226, 163, .25); border-radius: 7px; color: #d9cedd; background: rgba(40, 25, 51, .68); text-align: left; cursor: pointer; }
  .atlas-tabs button strong, .atlas-tabs button span { display: block; }
  .atlas-tabs button span { margin-top: 2px; color: #9e8ba9; font-size: 10px; }
  .atlas-tabs button.active { border-color: #ffc75f; color: #fff4d0; background: rgba(111, 69, 126, .55); box-shadow: 0 0 18px rgba(255, 199, 95, .18); }
  .atlas-tabs button:focus-visible, .back-link:focus-visible, .wordmark:focus-visible { outline: 3px solid #fff4d0; outline-offset: 3px; }
  .atlas-review { padding: clamp(18px, 3vw, 34px); border: 1px solid rgba(255, 226, 163, .24); border-radius: 16px; background: rgba(13, 10, 22, .56); box-shadow: 0 24px 70px rgba(0, 0, 0, .28); }
  .atlas-heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; margin-bottom: 22px; }
  .atlas-heading h2 { margin: 0; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: clamp(31px, 4vw, 48px); line-height: 1; }
  .atlas-heading > div > p:last-child { margin: 7px 0 0; color: #aa9bb0; }
  dl { display: flex; gap: 18px; margin: 0; }
  dl div { min-width: 88px; }
  dt { color: #9e8ba9; font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  dd { margin: 2px 0 0; color: #fff4d0; font-size: 12px; }
  .source-atlas { margin: 0 0 28px; }
  .source-image { position: relative; overflow: hidden; border: 1px solid rgba(255, 226, 163, .4); border-radius: 9px; background: #08070b; }
  .source-image img { display: block; width: 100%; height: auto; }
  .grid-overlay { position: absolute; inset: 0; pointer-events: none; }
  .grid-overlay i { position: absolute; border: 1px solid rgba(125, 226, 167, .85); box-shadow: inset 0 0 0 1px rgba(16, 26, 24, .55); }
  figcaption { margin-top: 6px; color: #9e8ba9; font-size: 11px; }
  .crop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: clamp(10px, 1.5vw, 18px); }
  .crop-card { min-width: 0; padding: 10px; border: 1px solid rgba(255, 226, 163, .2); border-radius: 9px; background: rgba(35, 23, 45, .7); }
  .crop-frame { position: relative; width: 100%; overflow: hidden; border: 1px solid rgba(255, 226, 163, .5); border-radius: 6px; background-color: #09070c; background-image: linear-gradient(45deg, #21172a 25%, transparent 25%), linear-gradient(-45deg, #21172a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #21172a 75%), linear-gradient(-45deg, transparent 75%, #21172a 75%); background-position: 0 0, 0 7px, 7px -7px, -7px 0; background-size: 14px 14px; }
  .crop-copy { display: grid; gap: 3px; margin-top: 8px; }
  .crop-copy strong { min-height: 2.4em; color: #fff4d0; line-height: 1.2; }
  .crop-copy code { color: #7de2a7; font-size: 10px; }
  .crop-copy span { color: #9e8ba9; font-size: 9px; }
  @media (max-width: 700px) {
    main { width: calc(100% - 24px); padding-bottom: 32px; }
    .masthead { min-height: 70px; }
    .wordmark { flex-direction: column; gap: 0; font-size: 15px; line-height: .8; }
    .wordmark strong { font-size: 25px; }
    .intro { display: block; padding: 34px 0 24px; }
    .intro h1 { font-size: 54px; }
    .review-status { width: max-content; margin-top: 20px; font-size: 12px; }
    .atlas-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-right: 0; padding-right: 0; overflow: visible; }
    .atlas-tabs button { min-width: 0; }
    .atlas-review { padding: 14px; }
    .atlas-heading { display: block; }
    dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 16px; }
    dl div { min-width: 0; }
    dd { font-size: 10px; }
    .crop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .crop-card { padding: 7px; }
    .crop-copy strong { font-size: 12px; }
  }
</style>
