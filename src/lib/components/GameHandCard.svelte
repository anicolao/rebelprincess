<script lang="ts">
  import GameCardFace from './GameCardFace.svelte';
  import type { GameArtwork as Artwork } from '$lib/game-ui';

  export let artwork: Artwork;
  export let rank: string | number;
  export let suit: string;
  export let badge = '';
  export let badgeAlign: 'left' | 'center' = 'center';
  export let muted = false;
  export let aspect = 3 / 5;
  export let accent = 'rgba(255, 226, 163, .5)';
  export let frameBorderWidth = '1px';
  export let framePadding = '0';
  export let elevated = false;
  export let disabled = false;
  export let selected = false;
  export let committed = false;
  export let playable = false;
  export let contributable = false;
  export let turnBlocked = false;
  export let ariaLabel: string;
  export let ariaDescribedby: string | undefined = undefined;

  $: aspectRatio = aspect === 3 / 5 ? '3 / 5' : aspect === 2 / 3 ? '2 / 3' : String(aspect);
</script>

<button
  type="button"
  class="game-hand-card playing-card"
  class:selected
  class:committed
  class:playable
  class:contributable
  class:turn-blocked={turnBlocked}
  class:elevated
  {disabled}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedby}
  style={`--game-hand-card-aspect: ${aspectRatio}; --game-hand-card-accent: ${accent}; --game-hand-card-border-width: ${frameBorderWidth}; --game-hand-card-padding: ${framePadding};`}
  on:click
>
  <GameCardFace {artwork} {rank} {suit} {badge} {badgeAlign} {muted} {aspect} />
</button>

<style>
  .game-hand-card {
    position: relative;
    width: var(--hand-card-width);
    height: auto;
    min-height: 0;
    aspect-ratio: var(--game-hand-card-aspect);
    overflow: hidden;
    flex: 0 0 auto;
    border: var(--game-hand-card-border-width) solid var(--game-hand-card-accent);
    border-radius: clamp(5px, .7cqh, 8px);
    padding: var(--game-hand-card-padding);
    color: #271631;
    background: #150d1d;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: transform .15s ease, filter .15s ease, box-shadow .15s ease;
  }
  :global(.game-hand-card + .game-hand-card) { margin-left: calc(-1 * var(--hand-card-overlap)); }
  .game-hand-card:disabled { opacity: 1; color: inherit; cursor: not-allowed; }
  .game-hand-card.elevated { box-shadow: 0 12px 24px rgba(0, 0, 0, .3); }
  .game-hand-card:focus-visible {
    outline: 3px solid #ffc75f;
    outline-offset: 3px;
  }
  .game-hand-card.contributable {
    border-color: #7de2a7;
    box-shadow: 0 0 0 2px #7de2a7, 0 0 18px rgba(125, 226, 167, .38);
    transform: translateY(-5px);
  }
  .game-hand-card.selected,
  .game-hand-card.committed {
    border: 3px solid #ffc75f;
    transform: translateY(-9px);
    box-shadow: 0 7px 18px rgba(0, 0, 0, .45);
  }
  .game-hand-card.committed { border-color: #7de2a7; }
  .game-hand-card.playable {
    z-index: 1;
    border: 3px solid #ffc75f;
    box-shadow: 0 0 0 2px rgba(255, 199, 95, .38), 0 0 22px rgba(255, 199, 95, .55), 0 9px 18px rgba(0, 0, 0, .45);
    transform: translateY(-8px);
  }
  .game-hand-card.playable:focus-visible,
  .game-hand-card.contributable:focus-visible {
    outline: 3px solid #fff4d0;
    outline-offset: 3px;
  }
  .game-hand-card.turn-blocked { filter: saturate(.25) brightness(.52); }
  @media (max-width: 760px) {
    .game-hand-card { font-size: 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .game-hand-card { transition: none; }
  }
</style>
