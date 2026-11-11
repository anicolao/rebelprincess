<script lang="ts">
  import GameLocalSeat from './GameLocalSeat.svelte';
  import GameOpponentSeat from './GameOpponentSeat.svelte';
  import GamePowerBurst from './GamePowerBurst.svelte';
  import GameRoundDisplay from './GameRoundDisplay.svelte';
  import GameTableSurface from './GameTableSurface.svelte';
  import GameTrick from './GameTrick.svelte';
  import type { HandCard, LocalSeat, OpponentSeat, SeatPrincess, TableRound, TrickPlay } from '$lib/game-ui';

  export let playerCount: number;
  export let opponents: OpponentSeat[] = [];
  export let round: TableRound;
  export let trick: TrickPlay[] = [];
  export let localSeat: LocalSeat | undefined = undefined;
  export let handCards: HandCard[] = [];
  export let onHandCard: (id: string) => void = () => {};
  export let onPrincess: (() => void) | undefined = undefined;
  export let princessLabel = '';
  export let collecting = false;
  export let doubleTrick = false;
  export let powerFlash = false;
  export let powerBurst: SeatPrincess | undefined = undefined;
  export let powerBurstKey = 0;
  export let spectatorTitle = '';
  export let spectatorStatus = '';
  export let ariaLabel = 'Game table';

  function seatStyle(index: number, count: number) {
    const layouts: Record<number, Array<[number, number]>> = {
      2: [[28, 3], [72, 3]],
      3: [[9, 34], [50, 3], [91, 34]],
      4: [[8, 35], [30, 3], [70, 3], [92, 35]],
      5: [[8, 35], [27, 5], [50, 1], [73, 5], [92, 35]]
    };
    const [x, y] = layouts[count]?.[index] ?? [50, 3];
    return `--seat-x: ${x}%; --seat-y: ${y}%; --seat-snap-x: calc(round(nearest, ${x}cqw, 1px) - ${x}cqw)`;
  }
</script>

<GameTableSurface {playerCount} {powerFlash} {ariaLabel}>
  <div class="opponents" aria-label="Opponents">
    {#each opponents as opponent, index (opponent.uid)}
      <GameOpponentSeat seat={opponent} {index} position={seatStyle(index, opponents.length)} />
      {#if opponent.showCaptured}<span class="sr-only" aria-label={`${opponent.name} captured cards`}>{opponent.capturedCardCount ?? 0}</span>{/if}
    {/each}
  </div>

  <GameRoundDisplay name={round.name} rule={round.rule} artwork={round.artwork} current={round.current} total={round.total} passCount={round.passCount} passDirection={round.passDirection}>
    <slot name="round-status" />
  </GameRoundDisplay>

  {#if powerBurst}{#key powerBurstKey}<GamePowerBurst princess={powerBurst} />{/key}{/if}
  <GameTrick plays={trick} {collecting} {doubleTrick} />

  {#if localSeat}
    {#if localSeat.showCaptured}<span class="sr-only" aria-label={`${localSeat.name} captured cards`}>{localSeat.capturedCardCount ?? 0}</span>{/if}
    <GameLocalSeat seat={localSeat} cards={handCards} onCard={onHandCard} {onPrincess} {princessLabel}>
      <svelte:fragment slot="controls"><slot name="local-controls" /></svelte:fragment>
      <svelte:fragment slot="status"><slot name="local-status" /></svelte:fragment>
    </GameLocalSeat>
  {:else if spectatorTitle}
    <aside class="spectator-panel" role="status"><strong>{spectatorTitle}</strong><span>{spectatorStatus}</span></aside>
  {/if}

  <slot name="overlay" />
</GameTableSurface>

<style>
  .spectator-panel { position: absolute; z-index: 5; right: 8px; bottom: 8px; left: 8px; display: flex; justify-content: center; align-items: baseline; gap: 10px; padding: 9px 12px; border: 1px solid rgba(184, 140, 223, .35); border-radius: 10px; color: #fff4d0; background: rgba(20, 13, 30, .9); text-align: center; }
  .spectator-panel span { color: #b88cdf; font-size: 12px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  :global(.active-power) { margin: 0; color: #b88cdf; font-size: clamp(11px, 1.45cqh, 14px); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
</style>
