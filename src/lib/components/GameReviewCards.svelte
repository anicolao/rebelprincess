<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import type { ReviewCard } from '$lib/game-ui';

  export let cards: ReviewCard[] = [];
  export let ariaLabel: string;
  export let layout: 'row' | 'column' = 'row';
</script>

<div class="review-cards" class:column={layout === 'column'} role="group" aria-label={ariaLabel}>
  {#each cards as card (card.id)}
    <span class="review-card" aria-label={card.label} style={`--review-aspect:${card.aspect ?? 3 / 5}`}>
      <GameArtwork artwork={card.artwork} />
      <strong>{card.rank}</strong>
    </span>
  {/each}
</div>

<style>
  .review-cards { display: flex; gap: 3px; }
  .review-cards.column { flex-direction: column; gap: 0; }
  .review-card { position: relative; display: block; width: clamp(34px, min(4cqw, 6cqh), 46px); aspect-ratio: var(--review-aspect); flex: 0 0 auto; overflow: hidden; border: 1px solid rgba(255, 226, 163, .6); border-radius: 4px; background-color: #150d1d; }
  .review-card strong { position: absolute; top: 1px; left: 3px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 13px; text-shadow: 0 1px 2px #000; }
</style>
