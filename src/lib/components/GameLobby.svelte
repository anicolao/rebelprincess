<script lang="ts">
  import GameArtwork from './GameArtwork.svelte';
  import type { LobbyPlayer, LobbyPrincess } from '$lib/game-ui';

  export let gameId: string;
  export let gameName: string;
  export let players: LobbyPlayer[];
  export let currentUid: string;
  export let princessOptions: LobbyPrincess[];
  export let selectedPrincess: string;
  export let minimumPlayers = 3;
  export let maximumPlayers = 6;
  export let lockPending = false;
  export let dealPending = false;
  export let lockLabel = 'Lock Princess';
  export let dealLabel = 'Shuffle and deal';
  export let waitingText = '';
  export let automaticText = '';
  export let actionError = '';
  export let onSelect: (id: string) => void;
  export let onLock: () => void;
  export let onDeal: () => void;
  export let onRemove: ((uid: string) => void) | undefined = undefined;
  export let removingUid = '';

  $: localPlayer = players.find((player) => player.uid === currentUid);
  $: host = players[0]?.uid === currentUid;
  $: allReady = players.length >= minimumPlayers && players.every((player) => player.ready);
</script>

<section class="room" aria-label={`${gameName} game room`}>
  <p class="room-label">Room code</p>
  <div class="room-code" data-testid="invite-code">{gameId}</div>
  <h2>Players · {players.length}</h2>
  <ul aria-label="Players">
    {#each players as player (player.uid)}
      <li>
        <span>{player.displayName}{#if players.every((candidate) => candidate.ready) && player.princessName}{' · '}{player.princessName}{:else}{' · Princess hidden'}{/if}</span>
        <span class="player-state">
          {#if player.host}<small>Host</small>{/if} {player.ready || player.committed ? 'Ready' : 'Choosing'}
          {#if player.removable && onRemove}
            <button class="remove-player" type="button" disabled={Boolean(removingUid)} aria-label={`Remove ${player.displayName}`} on:click={() => onRemove?.(player.uid)}>
              {removingUid === player.uid ? 'Removing…' : 'Remove'}
            </button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  {#if localPlayer && !localPlayer.ready && !localPlayer.committed}
    <fieldset class="choice-grid" aria-label="Choose one of your two Princesses">
      <legend>Choose one of your two dealt Princesses</legend>
      {#each princessOptions as princess}
        <button type="button" class="princess-choice" class:chosen={selectedPrincess === princess.id} aria-label={princess.name} aria-pressed={selectedPrincess === princess.id} data-princess-name={princess.name} on:click={() => onSelect(princess.id)}>
          <strong class="princess-choice-name">{princess.name}</strong>
          <span class="princess-choice-art" aria-hidden="true"><GameArtwork artwork={princess.artwork} /></span>
          <span class="princess-choice-copy">
            {#if princess.power}<b>{princess.power}</b>{/if}
            <small>{princess.text}</small>
          </span>
          <span class="princess-choice-mark" aria-hidden="true">✓</span>
        </button>
      {/each}
    </fieldset>
    <button class="primary" type="button" disabled={lockPending || !selectedPrincess} on:click={onLock}>{lockPending ? 'Sealing Princess…' : lockLabel}</button>
  {:else if localPlayer && !localPlayer.ready}
    <p class="waiting" role="status">Your Princess is sealed · waiting for every player to lock a choice</p>
  {/if}

  {#if players.length < minimumPlayers}
    <p class="minimum-player-note">{players.length} of {minimumPlayers} minimum players joined. You can lock your Princess now; dealing starts once the room has {minimumPlayers} players.</p>
  {/if}

  {#if host}
    {#if automaticText}<p class="automatic-rounds">{automaticText}</p>{/if}
    <slot name="host-controls" />
    {#if dealPending}
      <p class="waiting" role="status">Shuffling and dealing…</p>
    {:else}
      <button class="primary" type="button" disabled={!allReady} on:click={onDeal}>{dealLabel}</button>
    {/if}
  {/if}
  {#if actionError}<p class="form-error" role="alert">{actionError}</p>{/if}
  <p class="waiting">{waitingText || `${minimumPlayers} to ${maximumPlayers} players. The guest list updates live.`}</p>
</section>

<style>
  button { min-height: 48px; padding: 0 23px; border: 1px solid rgba(255, 226, 163, .38); border-radius: 3px; color: #271631; background: #ffc75f; font: inherit; font-weight: 700; cursor: pointer; }
  button:disabled { cursor: not-allowed; }
  button:focus-visible { outline: 3px solid #ffc75f; outline-offset: 3px; }
  .room { max-width: 560px; margin-top: 28px; padding: clamp(20px, 3vw, 28px); border: 1px solid rgba(255, 226, 163, .32); background: rgba(13, 8, 20, .5); }
  .room-label { margin: 0; color: #b6a7ba; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
  .room-code { margin: 2px 0 16px; color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 700; letter-spacing: .12em; }
  h2 { margin: 7px 0 6px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 239, 199, .16); color: #f9edcf; font-family: 'Cormorant Garamond', serif; font-size: 24px; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { display: flex; justify-content: space-between; padding: 7px 0; color: #fff5dc; }
  .room small { color: #b88cdf; letter-spacing: .1em; text-transform: uppercase; }
  .remove-player { width: auto; min-height: 0; margin-left: 6px; padding: 3px 7px; border: 1px solid rgba(255, 199, 95, .45); color: #ffc75f; background: transparent; font-size: 10px; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; min-width: 0; margin: 18px 0; padding: 0; border: 0; }
  .choice-grid legend { grid-column: 1 / -1; margin-bottom: 8px; color: #ffc75f; font-size: 13px; font-weight: 700; }
  .princess-choice { position: relative; display: grid; grid-template-columns: clamp(76px, 9vw, 96px) minmax(0, 1fr); grid-template-rows: auto 1fr; align-items: center; column-gap: 14px; row-gap: 10px; min-height: clamp(178px, 24vw, 220px); padding: 12px; color: #f8edfa; text-align: left; background: rgba(50, 31, 62, .7); }
  .princess-choice.chosen { border-color: #ffc75f; background: rgba(255, 199, 95, .18); box-shadow: inset 0 0 0 1px #ffc75f; }
  .princess-choice:disabled { opacity: .35; }
  .princess-choice-name { grid-column: 1 / -1; padding: 0 18px; color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: clamp(19px, 2.2vw, 24px); line-height: 1; text-align: center; }
  .princess-choice-art { position: relative; overflow: hidden; display: block; width: clamp(76px, 9vw, 96px); aspect-ratio: 3 / 5; border: 1px solid rgba(255, 226, 163, .65); border-radius: 7px; background: #150d1d; box-shadow: 0 10px 22px rgba(0, 0, 0, .48); }
  .princess-choice-copy { display: grid; gap: 5px; }
  .princess-choice-copy b { color: #ffc75f; font-size: 11px; }
  .princess-choice-copy small { color: #d9cedd; font-size: clamp(11px, 1.35vw, 14px); font-weight: 400; line-height: 1.35; }
  .princess-choice-mark { position: absolute; top: 7px; right: 8px; display: none; color: #ffc75f; font-size: 16px; }
  .princess-choice.chosen .princess-choice-mark { display: block; }
  .waiting { margin: 12px 0 0; color: #9f93a5; font-size: 13px; }
  .minimum-player-note, .automatic-rounds { margin: 18px 0 10px; padding: 10px 12px; border-left: 3px solid #b88cdf; color: #d9cedd; background: rgba(50, 31, 62, .45); font-size: 12px; line-height: 1.35; }
  .form-error { color: #ffaaa5; font-size: 13px; }
  :global([slot='host-controls']) { margin: 10px 0; }
  @media (max-width: 760px) {
    .room { max-width: none; padding: 15px; }
    .princess-choice { min-height: 168px; grid-template-columns: 68px minmax(0, 1fr); padding: 9px; column-gap: 9px; }
    .princess-choice-art { width: 68px; }
    .princess-choice-copy small { font-size: 10px; }
    h2 { margin: 0 0 2px; font-size: 20px; }
    button { min-height: 44px; padding: 0 16px; font-size: 14px; }
    .remove-player { min-height: 0; padding: 3px 7px; font-size: 10px; }
  }
</style>
