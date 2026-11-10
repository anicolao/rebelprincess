<script lang="ts">
  import SpriteCard from './SpriteCard.svelte';
  import type { GameArtwork } from '$lib/game-ui';

  export let artwork: GameArtwork;
</script>

{#if artwork.kind === 'sprite'}
  <SpriteCard {...artwork.sprite} />
{:else}
  <img src={artwork.src} alt={artwork.alt ?? ''} />
{/if}

<style>
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
