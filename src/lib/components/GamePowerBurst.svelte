<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import type { SeatPrincess } from '$lib/game-ui';
  export let princess: SeatPrincess;
</script>

<aside class="princess-power-burst" role="status" aria-label={`${princess.name} power activated`}>
  <span class="power-sparkles" aria-hidden="true">✦ · ✧ · ✦</span>
  <div class="princess-card" aria-hidden="true" style={`--princess-aspect:${princess.aspect ?? 3 / 5}`}><GameArtwork artwork={princess.artwork} /></div>
  <span>Princess power awakened</span>
  <strong>{princess.name}</strong>
  <p>{princess.power}</p>
</aside>

<style>
  .princess-power-burst { position: absolute; z-index: 25; top: 46%; left: 50%; display: grid; grid-template-columns: 76px minmax(0, 220px); grid-template-rows: auto auto auto 1fr; column-gap: 13px; width: min(86%, 340px); padding: 12px 16px 12px 12px; border: 2px solid #ffe2a3; border-radius: 13px; color: #fff5dc; background: linear-gradient(135deg, rgba(82, 47, 100, .98), rgba(20, 31, 43, .98)); box-shadow: 0 0 0 5px rgba(184, 140, 223, .22), 0 0 45px rgba(255, 226, 163, .45), 0 18px 50px rgba(0, 0, 0, .72); pointer-events: none; transform: translate(-50%, -50%); animation: princess-power-arrives .75s cubic-bezier(.2, .9, .25, 1.15) both; }
  .princess-card { position: relative; grid-row: 1 / -1; width: 76px; aspect-ratio: var(--princess-aspect); overflow: hidden; border: 1px solid rgba(255, 226, 163, .8); border-radius: 7px; background-color: #150d1d; box-shadow: 0 8px 20px rgba(0, 0, 0, .48); }
  .princess-power-burst > span:not(.power-sparkles) { align-self: end; color: #ffc75f; font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .princess-power-burst > strong { color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 24px; line-height: 1; }
  .princess-power-burst > p { margin: 5px 0 0; color: #e7dbe9; font-size: 11px; line-height: 1.25; }
  .power-sparkles { position: absolute; top: -18px; right: 8px; color: #ffe2a3; font-size: 22px; letter-spacing: 6px; text-shadow: 0 0 12px #fff; animation: power-sparkles 1.4s ease-in-out infinite alternate; }
  @keyframes princess-power-arrives { from { opacity: 0; transform: translate(-50%, -50%) scale(.55) rotate(-5deg); } to { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0); } }
  @keyframes power-sparkles { from { opacity: .55; transform: translateY(2px) scale(.92); } to { opacity: 1; transform: translateY(-3px) scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .princess-power-burst, .power-sparkles { animation: none; } }
</style>
