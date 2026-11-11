<script lang="ts">
  import GameCardFace from './GameCardFace.svelte';
  import type { TrickPlay } from '$lib/game-ui';

  export let plays: TrickPlay[] = [];
  export let collecting = false;
  export let doubleTrick = false;
  export let ariaLabel = '';

  $: resolvedAriaLabel = ariaLabel || (collecting ? 'Completed trick' : 'Current trick');
</script>

<section class="live-trick" class:collecting class:double-trick={doubleTrick} aria-label={resolvedAriaLabel}>
  {#each plays as play (play.id)}
    <article class="trick-play" style={play.collectStyle ?? ''} aria-label={`${play.playerName} played ${play.faceDown ? 'a face-down card' : play.label}`}>
      <span>{play.playerName}</span>
      <div
        class="trick-card"
        class:face-down={play.faceDown}
        style={`${play.originStyle ?? ''};--trick-aspect:${play.aspect ?? 3 / 5};--trick-accent:${play.accent ?? 'rgba(255, 226, 163, .7)'};--trick-border:${play.frameBorderWidth ?? '1px'};--trick-padding:${play.framePadding ?? '0'}`}
      >
        {#if !play.faceDown}<GameCardFace artwork={play.artwork} rank={play.rank} suit={play.suit} badge={play.badge ?? ''} badgeAlign={play.badgeAlign ?? 'center'} muted={play.muted ?? false} aspect={play.aspect ?? 3 / 5} display="trick" />{/if}
      </div>
    </article>
  {/each}
</section>

<style>
  .live-trick { position: absolute; z-index: 4; top: 59%; left: 50%; display: flex; justify-content: center; align-items: flex-end; gap: clamp(6px, 1cqw, 12px); width: min(92%, 560px); color: #fff4d0; font-size: clamp(10px, 1.4cqh, 13px); pointer-events: none; transform: translateX(-50%); }
  .trick-play { display: grid; justify-items: center; gap: 2px; }
  .trick-card { position: relative; width: clamp(48px, min(6.5cqw, 10cqh), 78px); aspect-ratio: var(--trick-aspect); overflow: hidden; border: var(--trick-border) solid var(--trick-accent); border-radius: 6px; padding: var(--trick-padding); background-color: #150d1d; box-shadow: 0 9px 20px rgba(0, 0, 0, .52); animation: play-to-table .35s ease-out both; }
  .trick-card.face-down { background: repeating-linear-gradient(135deg, #251638 0 7px, #604077 7px 10px); }
  .live-trick.collecting .trick-play { animation: collect-trick 3s ease-in-out forwards; }
  .live-trick.double-trick.collecting .trick-play { animation: none; }
  @keyframes play-to-table { from { opacity: .3; transform: translate(var(--play-x), var(--play-y)) scale(1.15); } to { opacity: 1; transform: translate(0, 0) scale(1); } }
  @keyframes collect-trick { 0%, 62% { opacity: 1; transform: translate(0, 0) scale(1); } 100% { opacity: 0; transform: translate(var(--collect-x), var(--collect-y)) scale(.65); } }
  @media (max-width: 760px) {
    .live-trick.double-trick { width: 96%; gap: 2px; font-size: 8px; }
    .live-trick.double-trick .trick-card { width: 36px; }
  }
  @media (prefers-reduced-motion: reduce) { .trick-card { animation: none; } }
</style>
