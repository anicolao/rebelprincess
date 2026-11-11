<script lang="ts">
  import GameHandCard from './GameHandCard.svelte';
  import type { HandCard } from '$lib/game-ui';

  export let ariaLabel = 'Your hand';
  export let cards: HandCard[] | undefined = undefined;
  export let onCard: ((id: string) => void) | undefined = undefined;
</script>

<div class="game-hand hand" role="region" aria-label={ariaLabel}>
  {#if cards}
    {#each cards as card (card.id)}
      <GameHandCard
        artwork={card.artwork}
        rank={card.rank}
        suit={card.suit}
        badge={card.badge ?? ''}
        badgeAlign={card.badgeAlign ?? 'center'}
        muted={card.muted ?? false}
        aspect={card.aspect ?? 3 / 5}
        accent={card.accent ?? 'rgba(255, 226, 163, .5)'}
        frameBorderWidth={card.frameBorderWidth ?? '1px'}
        framePadding={card.framePadding ?? '0'}
        elevated={card.elevated ?? false}
        disabled={card.disabled ?? false}
        selected={card.selected ?? false}
        committed={card.committed ?? false}
        playable={card.playable ?? false}
        contributable={card.contributable ?? false}
        turnBlocked={card.turnBlocked ?? false}
        ariaLabel={card.label}
        ariaDescribedby={card.describedBy}
        on:click={() => onCard?.(card.id)}
      />
    {/each}
  {:else}
    <slot />
  {/if}
</div>

<style>
  .game-hand {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    min-height: clamp(96px, 18cqh, 180px);
    padding-top: 10px;
  }
  @media (max-width: 760px) {
    .game-hand { min-height: clamp(92px, 17cqh, 138px); }
  }
</style>
