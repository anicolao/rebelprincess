<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import GameReviewCards from './GameReviewCards.svelte';
  import type { OpponentSeat } from '$lib/game-ui';

  export let seat: OpponentSeat;
  export let index: number;
  export let position = '';
</script>

<section
  class="opponent-seat"
  class:action-active={seat.active}
  class:action-complete={seat.complete}
  style={position}
  data-clockwise-seat={index + 1}
  data-action-state={seat.active ? 'active' : seat.complete ? 'complete' : 'idle'}
  aria-label={`${seat.name}'s hand`}
>
  <strong>{seat.name} · {seat.handCount} {#if seat.leader}<span class="lead-marker">Leads</span>{/if}</strong>
  {#if seat.summary}<span class="seat-summary">{seat.summary}</span>{/if}
  {#if seat.actionLabel}<span class:active={seat.active} class:complete={seat.complete} class="action-marker" aria-label={`${seat.name}: ${seat.actionLabel}`}>{seat.complete ? '✓ ' : ''}{seat.actionLabel}</span>{/if}
  <div class="seat-princess" class:exhausted={seat.princess.exhausted} class:power-active={seat.princess.active} aria-label={`${seat.name}'s Princess: ${seat.princess.name}`}>
    <div class="princess-card" style={`--princess-aspect:${seat.princess.aspect ?? 3 / 5}`}><GameArtwork artwork={seat.princess.artwork} /></div>
    <strong>{seat.princess.name}</strong>
    <span>{seat.princess.power}</span>
  </div>
  <div class="card-backs" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  {#if seat.revealedCards?.length}
    <div class="revealed-cards"><GameReviewCards cards={seat.revealedCards} ariaLabel={seat.revealedLabel ?? `${seat.name}'s revealed cards`} layout="column" /></div>
  {/if}
  {#if seat.showCaptured}
    <details class="trick-counter">
      <summary aria-label={`${seat.name} tricks`}>{seat.capturedCount ?? 0}</summary>
      {#if seat.lastCaptured?.length}<div class="trick-review"><GameReviewCards cards={seat.lastCaptured} ariaLabel={`${seat.name} last trick`} /></div>{/if}
    </details>
  {/if}
</section>

<style>
  .opponent-seat { position: absolute; z-index: 2; top: var(--seat-y); left: var(--seat-x); width: clamp(118px, min(14cqw, 19cqh), 170px); min-height: clamp(78px, 13cqh, 118px); color: #e9deeb; text-align: center; transform: translateX(-50%); }
  .opponent-seat::before { content: ''; position: absolute; z-index: -1; inset: -7px -9px -8px; border: 2px solid transparent; border-radius: 10px; pointer-events: none; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
  .opponent-seat.action-active::before { border-color: #ffc75f; background: rgba(255, 199, 95, .08); box-shadow: 0 0 0 3px rgba(255, 199, 95, .12), 0 0 20px rgba(255, 199, 95, .4); }
  .opponent-seat > strong { display: block; margin-bottom: 5px; font-size: clamp(12px, 1.7cqh, 15px); }
  .seat-summary { display: block; color: #b88cdf; font-size: clamp(8px, 1.2cqh, 10px); }
  .action-marker { display: flex; align-items: center; width: max-content; max-width: 138px; margin: 0 auto 5px; padding: 3px 8px; border: 1px solid currentColor; border-radius: 999px; color: #ffc75f; background: rgba(33, 19, 41, .88); font-size: clamp(9px, 1.25cqh, 11px); font-weight: 700; line-height: 1.2; white-space: nowrap; }
  .action-marker.active::before { content: ''; width: 5px; height: 5px; margin-right: 4px; flex: 0 0 5px; border-radius: 50%; background: currentColor; }
  .opponent-seat.action-active > .action-marker { position: relative; left: var(--seat-snap-x); width: calc-size(max-content, round(nearest, size, 1px)); }
  .action-marker.complete { color: #7de2a7; }
  .seat-princess { position: absolute; top: clamp(25px, 4.3cqh, 40px); left: 2px; display: grid; justify-items: center; width: clamp(54px, 5.5cqw, 76px); color: #e9deeb; font-size: clamp(8px, 1.15cqh, 10px); line-height: 1.12; }
  .seat-princess .princess-card { position: relative; overflow: hidden; width: clamp(44px, min(4.6cqw, 7cqh), 62px); aspect-ratio: var(--princess-aspect); min-height: 0; padding: 0; border: 1px solid rgba(255, 226, 163, .65); border-radius: 5px; background-color: #150d1d; box-shadow: 0 7px 16px rgba(0, 0, 0, .45); transform-origin: bottom center; transition: filter .2s ease, transform .2s ease; }
  .seat-princess > strong { max-width: 82px; margin-top: 3px; color: #ffc75f; font-size: clamp(9px, 1.3cqh, 11px); }
  .seat-princess > span { display: block; width: clamp(68px, 7cqw, 96px); margin-top: 2px; color: #d9cedd; text-align: center; }
  .seat-princess.exhausted .princess-card { filter: grayscale(1) saturate(0); transform: rotate(-12deg); }
  .seat-princess.exhausted > strong, .seat-princess.exhausted > span { color: #776f7b; }
  .seat-princess.power-active .princess-card { filter: none; border-color: #fff4d0; box-shadow: 0 0 0 3px #b88cdf, 0 0 25px #ffe2a3; animation: active-princess-card .85s ease-in-out infinite alternate; }
  .seat-princess.power-active > strong { color: #fff4d0; text-shadow: 0 0 8px #ffc75f; }
  .lead-marker { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 999px; color: #211329; background: #ffc75f; font-family: 'Atkinson Hyperlegible', sans-serif; font-size: 9px; text-transform: uppercase; }
  .card-backs { display: flex; justify-content: center; height: clamp(52px, 8cqh, 70px); margin-left: clamp(45px, 5cqw, 66px); }
  .card-backs i { width: clamp(34px, min(3.4cqw, 5.5cqh), 46px); height: clamp(50px, min(5.2cqw, 8cqh), 68px); margin-left: clamp(-28px, -2.2cqw, -19px); border: 1px solid #b88cdf; border-radius: 4px; background: repeating-linear-gradient(135deg, #251638 0 4px, #604077 4px 6px); box-shadow: 0 4px 9px rgba(0, 0, 0, .38); }
  .card-backs i:first-child { margin-left: 0; }
  .trick-counter { position: absolute; z-index: 8; top: 18px; right: -5px; }
  .trick-counter summary { display: grid; place-items: center; width: clamp(25px, 3.5cqh, 32px); height: clamp(25px, 3.5cqh, 32px); border: 1px solid #ffc75f; border-radius: 50%; color: #211329; background: #ffc75f; box-shadow: 0 3px 9px rgba(0, 0, 0, .45); cursor: pointer; font-size: clamp(11px, 1.6cqh, 14px); font-weight: 700; list-style: none; }
  .trick-counter summary::-webkit-details-marker { display: none; }
  .trick-review { position: absolute; z-index: 9; top: 27px; left: 50%; display: none; padding: 5px; border: 1px solid rgba(255, 226, 163, .6); border-radius: 6px; background: rgba(20, 13, 30, .96); box-shadow: 0 8px 24px rgba(0, 0, 0, .6); transform: translateX(-50%); }
  .trick-counter[open] .trick-review, .trick-counter:hover .trick-review, .trick-counter:focus-within .trick-review { display: block; }
  @keyframes active-princess-card { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-5px) rotate(2deg); } }
  @media (max-width: 760px) {
    .opponent-seat { width: 118px; min-height: 82px; }
    .seat-princess { top: 28px; width: 52px; }
    .seat-princess .princess-card { width: 42px; }
    .seat-princess > span { width: 60px; font-size: 8px; }
    .card-backs { height: 54px; margin-left: 42px; }
    .card-backs i { width: 34px; height: 50px; margin-left: -21px; }
    .card-backs i:first-child { margin-left: -21px; }
  }
  @media (prefers-reduced-motion: reduce) { .seat-princess.power-active .princess-card { animation: none; } }
</style>
