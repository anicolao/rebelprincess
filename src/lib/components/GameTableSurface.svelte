<script lang="ts">
  export let playerCount: number;
  export let powerFlash = false;
  export let ariaLabel = 'Dealt game';
</script>

<section class="table" aria-label={ariaLabel}>
  <div class="table-board" class:power-flash={powerFlash} data-player-count={playerCount}>
    <slot />
  </div>
</section>

<style>
  .table { width: 100%; height: 100%; }
  .table-board { --hand-card-width: clamp(54px, min(8cqw, 11cqh), 108px); --hand-card-overlap: clamp(22px, 4cqw, 36px); position: relative; width: 100%; height: 100%; overflow: hidden; container-type: size; border: 1px solid rgba(255, 226, 163, .2); border-radius: 18px; background: radial-gradient(ellipse at center, rgba(75, 44, 91, .72), rgba(19, 25, 35, .88) 70%); box-shadow: inset 0 0 90px rgba(0, 0, 0, .35); }
  .table-board.power-flash::after { content: ''; position: absolute; z-index: 19; inset: 0; pointer-events: none; background: radial-gradient(circle, rgba(255, 246, 194, .62), rgba(184, 140, 223, .28) 38%, transparent 72%); animation: flash 1.25s ease-out both; }
  @keyframes flash { from { opacity: 1; } to { opacity: 0; } }
  @media (max-width: 760px) {
    .table-board { --hand-card-width: clamp(42px, 13cqw, 50px); --hand-card-overlap: clamp(19px, 5cqw, 21px); }
    .table-board[data-player-count='4'] :global(.opponent-seat) { width: 100px; }
    .table-board[data-player-count='4'] :global(.opponent-seat[data-clockwise-seat='1']) { --seat-x: 16% !important; --seat-y: 28% !important; }
    .table-board[data-player-count='4'] :global(.opponent-seat[data-clockwise-seat='3']) { --seat-x: 84% !important; --seat-y: 28% !important; }
    .table-board[data-player-count='5'] :global(.opponent-seat),
    .table-board[data-player-count='6'] :global(.opponent-seat) { width: 88px; }
    .table-board[data-player-count='5'] :global(.opponent-seat[data-clockwise-seat='1']),
    .table-board[data-player-count='6'] :global(.opponent-seat[data-clockwise-seat='1']) { --seat-x: 14% !important; --seat-y: 28% !important; }
    .table-board[data-player-count='5'] :global(.opponent-seat[data-clockwise-seat='2']) { --seat-x: 37% !important; --seat-y: 3% !important; }
    .table-board[data-player-count='5'] :global(.opponent-seat[data-clockwise-seat='3']) { --seat-x: 63% !important; --seat-y: 3% !important; }
    .table-board[data-player-count='5'] :global(.opponent-seat[data-clockwise-seat='4']),
    .table-board[data-player-count='6'] :global(.opponent-seat[data-clockwise-seat='5']) { --seat-x: 86% !important; --seat-y: 28% !important; }
    .table-board[data-player-count='6'] :global(.opponent-seat[data-clockwise-seat='2']) { --seat-x: 25% !important; --seat-y: 3% !important; }
    .table-board[data-player-count='6'] :global(.opponent-seat[data-clockwise-seat='3']) { --seat-x: 50% !important; --seat-y: 1% !important; }
    .table-board[data-player-count='6'] :global(.opponent-seat[data-clockwise-seat='4']) { --seat-x: 75% !important; --seat-y: 3% !important; }
    .table-board[data-player-count='5'] :global(.seat-princess),
    .table-board[data-player-count='6'] :global(.seat-princess) { width: 38px; left: 0; }
    .table-board[data-player-count='5'] :global(.seat-princess .princess-card),
    .table-board[data-player-count='6'] :global(.seat-princess .princess-card) { width: 34px; }
    .table-board[data-player-count='5'] :global(.seat-princess > span),
    .table-board[data-player-count='6'] :global(.seat-princess > span) { width: 44px; font-size: 6px; }
    .table-board[data-player-count='5'] :global(.card-backs),
    .table-board[data-player-count='6'] :global(.card-backs) { margin-left: 30px; }
  }
  @media (prefers-reduced-motion: reduce) { .table-board.power-flash::after { animation: none; } }
</style>
