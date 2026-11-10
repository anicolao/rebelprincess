<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import type { GameArtwork as Artwork } from '$lib/game-ui';

  export let artwork: Artwork;
  export let rank: string | number;
  export let suit: string;
  export let badge = '';
  export let badgeAlign: 'left' | 'center' = 'center';
  export let muted = false;
  export let aspect = 3 / 5;
  export let display: 'hand' | 'trick' = 'hand';
</script>

<span class="card-face" class:muted style={`--card-aspect: ${aspect};`}>
  <GameArtwork {artwork} />
  <strong class:trick={display === 'trick'}>{rank}</strong>
  <small class:trick={display === 'trick'}>{suit}</small>
  {#if badge}<em class:left={badgeAlign === 'left'} class:trick={display === 'trick'}>{badge}</em>{/if}
</span>

<style>
  .card-face { display: contents; }
  .card-face.muted :global(img), .card-face.muted :global(svg) { opacity: .72; }
  strong { position: absolute; top: 5px; left: 8px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: clamp(25px, 4cqh, 36px); line-height: normal; text-shadow: 0 1px 3px #000; }
  small { position: absolute; right: 5px; bottom: 5px; left: 5px; color: #fff4d0; font-size: clamp(9px, 1.4cqh, 12px); text-align: center; text-transform: capitalize; text-shadow: 0 1px 3px #000; }
  em { position: absolute; z-index: 2; right: 0; bottom: 0; left: 0; padding: 3px 1px 3px 4px; color: #102019; background: #7de2a7; font-size: 8px; font-style: normal; line-height: normal; text-align: center; white-space: nowrap; }
  em.left { text-align: left; }
  strong.trick { top: 2px; left: 5px; font-size: 20px; }
  small.trick { right: 3px; bottom: 3px; left: 3px; font-size: 7px; }
  em.trick { bottom: 14px; padding: 0; color: #211329; background: #ffc75f; font-size: 8px; font-weight: 700; text-align: center; }
</style>
