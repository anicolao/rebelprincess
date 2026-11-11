<script lang="ts">
  export let displayName: string;
  export let inviteCode: string;
  export let selectedVariant: 'rebel' | 'zombie';
  export let disabled = false;
  export let actionError = '';
  export let onCreate: () => void;
  export let onJoin: () => void;
</script>

<form class="room-form" on:submit|preventDefault={onCreate}>
  <label for="display-name">Your name</label>
  <input id="display-name" bind:value={displayName} maxlength="30" autocomplete="nickname" placeholder="Princess name" />
  <fieldset class="variant-choice">
    <legend>Game</legend>
    <label class:chosen={selectedVariant === 'rebel'}>
      <input type="radio" name="game-variant" bind:group={selectedVariant} value="rebel" />
      <strong>Rebel Princess</strong><span>Avoid proposals across five rounds.</span>
    </label>
    <label class:chosen={selectedVariant === 'zombie'}>
      <input type="radio" name="game-variant" bind:group={selectedVariant} value="zombie" />
      <strong>Zombie Princess</strong><span>Bid for tricks and manage skulls across four rounds.</span>
    </label>
  </fieldset>
  <div class="actions">
    <button type="submit" {disabled}>Create a game</button>
    <span>or</span>
    <label class="sr-only" for="invite-code">Room code</label>
    <input id="invite-code" bind:value={inviteCode} maxlength="8" placeholder="ROOM CODE" />
    <button class="secondary" type="button" {disabled} on:click={onJoin}>Join</button>
  </div>
  {#if actionError}<p class="form-error" role="alert">{actionError}</p>{/if}
</form>

<style>
  .room-form { margin-top: 28px; }
  .room-form > label { display: block; margin-bottom: 7px; color: #e4d8e5; font-size: 13px; }
  input { min-width: 0; min-height: 46px; padding: 0 13px; border: 1px solid rgba(255, 226, 163, .38); border-radius: 3px; color: #fff5dc; background: rgba(13, 8, 20, .7); font: inherit; }
  input:focus { outline: 2px solid #b88cdf; outline-offset: 2px; }
  .room-form > input { width: min(100%, 330px); }
  .variant-choice { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; min-width: 0; max-width: 650px; margin: 22px 0 0; padding: 0; border: 0; }
  .variant-choice legend { grid-column: 1 / -1; margin-bottom: 3px; color: #e4d8e5; font-size: 13px; font-weight: 700; }
  .variant-choice label { position: relative; display: grid; gap: 3px; padding: 14px 16px; border: 1px solid rgba(255, 226, 163, .24); border-radius: 12px; color: #bdb0c4; background: rgba(13, 8, 20, .38); cursor: pointer; }
  .variant-choice label.chosen { border-color: #ffc75f; color: #fff5dc; background: rgba(112, 66, 119, .3); box-shadow: inset 0 0 0 1px rgba(255, 199, 95, .35); }
  .variant-choice input { position: absolute; opacity: 0; pointer-events: none; }
  .variant-choice strong { font-family: 'Cormorant Garamond', serif; font-size: 21px; }
  .variant-choice span { font-size: 12px; line-height: 1.35; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin-top: 34px; }
  .actions input { width: 132px; text-transform: uppercase; }
  .actions > span { max-width: 180px; color: #9f93a5; font-size: 13px; line-height: 1.35; }
  button { min-height: 48px; padding: 0 23px; border: 1px solid rgba(255, 226, 163, .38); border-radius: 3px; color: #271631; background: #ffc75f; font: inherit; font-weight: 700; cursor: pointer; }
  button.secondary { color: #fff4d0; background: transparent; }
  button:disabled { cursor: not-allowed; }
  .form-error { color: #ffaaa5; font-size: 13px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  @media (max-width: 760px) {
    .variant-choice { grid-template-columns: 1fr; }
    .actions { gap: 12px; margin-top: 23px; }
    .actions input { width: 118px; }
    .actions > span { max-width: 155px; font-size: 11px; }
    button { min-height: 44px; padding: 0 16px; font-size: 14px; }
  }
</style>
