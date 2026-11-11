<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import GameHand from './GameHand.svelte';
  import GameReviewCards from './GameReviewCards.svelte';
  import type { HandCard, LocalSeat } from '$lib/game-ui';

  export let seat: LocalSeat;
  export let cards: HandCard[] = [];
  export let onCard: (id: string) => void;
  export let onPrincess: (() => void) | undefined = undefined;
  export let princessLabel = '';
</script>

<section class="local-seat" class:action-active={seat.active} class:action-complete={seat.complete} data-action-state={seat.active ? 'active' : seat.complete ? 'complete' : 'idle'} aria-label="Your seat">
  <div class="local-heading" class:local-leader={seat.leader}>
    <strong>{seat.name} · You {#if seat.leader}<span class="lead-marker">You lead</span>{/if}</strong>
    <span>{seat.handCount} cards{seat.summary ? ` · ${seat.summary}` : ''}</span>
  </div>
  {#if seat.actionLabel}<span class:active={seat.active} class:complete={seat.complete} class="action-marker local-action-marker" aria-label={`You: ${seat.actionLabel}`}>{seat.complete ? '✓ ' : ''}{seat.actionLabel}</span>{/if}
  {#if seat.princess}
    <div class="seat-princess local-princess" class:exhausted={seat.princess.exhausted} class:armed={seat.princess.armed} class:power-active={seat.princess.active}>
      <button type="button" class="princess-card" style={`--princess-aspect:${seat.princess.aspect ?? 3 / 5}`} aria-label={princessLabel || `Use ${seat.princess.name} power`} aria-pressed={seat.princess.pressed ?? seat.princess.armed ?? false} disabled={!seat.princess.usable} on:click={() => onPrincess?.()}>
        <GameArtwork artwork={seat.princess.artwork} />
      </button>
      <strong>{seat.princess.name}</strong>
      <span>{seat.princess.power}</span>
      {#if seat.princess.status}<small class="princess-status" role="status">{seat.princess.status}</small>{/if}
    </div>
  {/if}
  <slot name="controls" />
  {#if seat.showCaptured}
    <details class="trick-counter local-counter">
      <summary aria-label={`${seat.name} tricks`}>{seat.capturedCount ?? 0}</summary>
      {#if seat.lastCaptured?.length}<div class="trick-review"><GameReviewCards cards={seat.lastCaptured} ariaLabel={`${seat.name} last trick`} /></div>{/if}
    </details>
  {/if}
  <GameHand {cards} {onCard} />
  <slot name="status" />
</section>

<style>
  .local-seat { position: absolute; z-index: 3; inset: auto 8px 8px; }
  .local-heading { display: flex; justify-content: center; gap: 14px; margin-bottom: 6px; color: #fff4d0; font-size: clamp(12px, 1.8cqh, 16px); }
  .local-heading span { color: #b88cdf; }
  .local-seat.action-active .local-heading { color: #ffc75f; text-shadow: 0 0 10px rgba(255, 199, 95, .6); }
  .local-heading.local-leader { width: max-content; margin-right: auto; margin-left: auto; padding: 4px 9px; border: 1px solid #ffc75f; border-radius: 999px; color: #ffc75f; box-shadow: 0 0 14px rgba(255, 199, 95, .3); }
  .local-heading.local-leader .lead-marker { color: #211329; }
  .lead-marker { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 999px; color: #211329; background: #ffc75f; font-family: 'Atkinson Hyperlegible', sans-serif; font-size: 9px; text-transform: uppercase; }
  .action-marker { display: flex; align-items: center; width: max-content; max-width: 138px; margin: 0 auto 5px; padding: 3px 8px; border: 1px solid currentColor; border-radius: 999px; color: #ffc75f; background: rgba(33, 19, 41, .88); font-size: clamp(9px, 1.25cqh, 11px); font-weight: 700; line-height: 1.2; white-space: nowrap; }
  .action-marker.active::before { content: ''; width: 5px; height: 5px; margin-right: 4px; flex: 0 0 5px; border-radius: 50%; background: currentColor; }
  .action-marker.complete { color: #7de2a7; }
  .local-action-marker { margin-top: -2px; margin-bottom: -2px; }
  .seat-princess { display: grid; justify-items: center; color: #e9deeb; font-size: clamp(8px, 1.15cqh, 10px); line-height: 1.12; }
  .local-princess { position: absolute; z-index: 7; right: auto; bottom: 6px; left: 8px; width: clamp(78px, 8cqw, 112px); }
  .princess-card { position: relative; overflow: hidden; width: clamp(58px, min(6cqw, 9cqh), 88px); aspect-ratio: var(--princess-aspect, 3 / 5); min-height: 0; padding: 0; border: 1px solid rgba(255, 226, 163, .65); border-radius: 5px; background-color: #150d1d; box-shadow: 0 7px 16px rgba(0, 0, 0, .45); cursor: pointer; transform-origin: bottom center; transition: filter .2s ease, transform .2s ease; }
  .local-princess > strong { max-width: 82px; margin-top: 3px; color: #ffc75f; font-size: clamp(10px, 1.4cqh, 12px); }
  .local-princess > span { display: block; width: clamp(82px, 8cqw, 112px); margin-top: 2px; color: #d9cedd; font-size: clamp(9px, 1.2cqh, 11px); text-align: center; }
  .local-princess.exhausted .princess-card { filter: grayscale(1) saturate(0); transform: rotate(-12deg); }
  .local-princess.exhausted > strong, .local-princess.exhausted > span { color: #776f7b; }
  .local-princess.armed .princess-card { border-color: #7de2a7; box-shadow: 0 0 0 2px #7de2a7, 0 5px 12px rgba(0, 0, 0, .45); }
  .local-princess.power-active .princess-card { filter: none; border-color: #fff4d0; box-shadow: 0 0 0 3px #b88cdf, 0 0 25px #ffe2a3; animation: active-princess-card .85s ease-in-out infinite alternate; }
  .local-princess .princess-card:disabled { cursor: default; opacity: 1; }
  .princess-status { width: 120px; color: #7de2a7; font-size: 9px; }
  .trick-counter { position: absolute; z-index: 8; top: 0; right: 8px; }
  .trick-counter summary { display: grid; place-items: center; width: clamp(25px, 3.5cqh, 32px); height: clamp(25px, 3.5cqh, 32px); border: 1px solid #ffc75f; border-radius: 50%; color: #211329; background: #ffc75f; box-shadow: 0 3px 9px rgba(0, 0, 0, .45); cursor: pointer; font-size: clamp(11px, 1.6cqh, 14px); font-weight: 700; list-style: none; }
  .trick-counter summary::-webkit-details-marker { display: none; }
  .trick-review { position: absolute; z-index: 9; right: 0; bottom: 27px; display: none; padding: 5px; border: 1px solid rgba(255, 226, 163, .6); border-radius: 6px; background: rgba(20, 13, 30, .96); box-shadow: 0 8px 24px rgba(0, 0, 0, .6); }
  .trick-counter[open] .trick-review, .trick-counter:hover .trick-review, .trick-counter:focus-within .trick-review { display: block; }
  @keyframes active-princess-card { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-5px) rotate(2deg); } }
  @media (max-width: 760px) {
    .local-seat { bottom: 2px; }
    .local-princess { top: 28px; bottom: clamp(116px, 18cqh, 150px); left: 4px; width: 52px; }
    .local-princess .princess-card { width: 42px; }
    .local-princess > span { width: 60px; font-size: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { .local-princess.power-active .princess-card { animation: none; } }
</style>
