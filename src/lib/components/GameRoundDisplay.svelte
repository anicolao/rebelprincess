<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import type { GameArtwork as Artwork } from '$lib/game-ui';

  export let name: string;
  export let rule: string;
  export let artwork: Artwork;
  export let current: number;
  export let total: number;
  export let mode: 'center' | 'banner' = 'center';
</script>

<article class="round-display" class:center={mode === 'center'} class:round-center={mode === 'center'} class:banner={mode === 'banner'} aria-label="Current Round card">
  {#if mode === 'center'}
    <h2>{name}</h2>
    <div class="round-art"><GameArtwork {artwork} /></div>
    <span class="round-rule">{rule}</span>
    <slot name="details" />
    <p class="round-count">Round {current} of {total}</p>
    <slot />
  {:else}
    <div class="round-copy">
      <p>Round {current} of {total}</p>
      <h2>{name}</h2>
      <span>{rule}</span>
      <slot name="details" />
    </div>
    <div class="round-art"><GameArtwork {artwork} /></div>
    <slot />
  {/if}
</article>

<style>
  .round-display { color: #fff4d0; }
  .round-center { position: absolute; top: 43%; left: 50%; width: clamp(210px, min(24cqw, 31cqh), 300px); margin: 0; text-align: center; transform: translate(-50%, -50%); }
  .round-copy p { margin: 0; color: #b88cdf; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h2 { margin: 0; color: #f9edcf; font-family: 'Cormorant Garamond', serif; line-height: 1; }
  .round-copy > span { display: block; color: #eee4f0; line-height: 1.3; }
  .round-art { position: relative; overflow: hidden; border: 1px solid rgba(255, 226, 163, .5); border-radius: 9px; box-shadow: 0 12px 28px rgba(0, 0, 0, .48); }
  .center { text-align: center; }
  .center h2 { font-size: clamp(20px, 3cqh, 30px); }
  .center .round-rule { display: block; max-width: 260px; margin: 7px auto 0; color: #eee4f0; font-size: clamp(11px, 1.6cqh, 15px); line-height: 1.22; }
  .center .round-art { width: clamp(106px, 58%, 160px); aspect-ratio: 1; margin: clamp(6px, 1cqh, 10px) auto; }
  .center .round-count { margin: 4px 0 0; color: #b88cdf; font-size: clamp(11px, 1.45cqh, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .center :global(.active-power) { margin: 0; color: #b88cdf; font-size: clamp(11px, 1.45cqh, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .banner { display: grid; grid-template-columns: 1fr clamp(100px, 14vw, 190px); gap: 30px; align-items: center; }
  .banner h2 { font-size: clamp(45px, 6vw, 76px); line-height: .9; }
  .banner .round-copy > span { max-width: 760px; margin-top: 12px; color: #d9cedd; }
  .banner .round-art { width: 100%; aspect-ratio: 1; border: 7px solid #d6c69a; border-radius: 14px; }
  @media (max-width: 760px) {
    .round-center { top: 42%; }
    .center .round-rule { max-width: 220px; }
    .banner { grid-template-columns: 1fr 100px; gap: 14px; }
    .banner h2 { font-size: 42px; }
  }
</style>
