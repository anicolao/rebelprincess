<script lang="ts">
  export let ariaLabel = 'Your hand';
</script>

<div class="game-hand hand" role="region" aria-label={ariaLabel}>
  <slot />
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
