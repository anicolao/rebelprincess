<script lang="ts">
  export let title: string;
  export let ariaLabel: string;
</script>

<section class="game-results round-results" aria-label={ariaLabel}>
  <h2>{title}</h2>
  <slot />
</section>

<style>
  .game-results { position: absolute; z-index: 20; inset: 8% 12%; display: flex; flex-direction: column; align-items: center; overflow: auto; padding: 14px; border: 1px solid rgba(255, 226, 163, .65); border-radius: 12px; color: #fff4d0; background: #140d1e; box-shadow: 0 18px 60px rgba(0, 0, 0, .7); }
  .game-results > :global(*) { flex-shrink: 0; }
  .game-results h2 { margin: 0 0 8px; color: #f9edcf; font-family: 'Cormorant Garamond', serif; }
  @media (max-width: 760px) {
    .game-results { inset: 8% 5%; }
    .game-results h2 { font-size: 20px; }
  }
</style>
