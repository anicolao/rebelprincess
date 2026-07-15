<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import suitAtlas from '../../assets/generated/suited-card-families.png';
  import roundAtlas from '../../assets/generated/round-rule-vignettes.png';
  import { ensureAnonymousIdentity, firebaseDatabase, probeFirebase } from '$lib/firebase';
  import {
    appendGameEvent,
    loadGame,
    normalizeGameId,
    subscribeToGame,
    type GameProjection
  } from '$lib/game-events';
  import { cardLabel, dealForPlayers, PRINCESSES, ROUND_RULES, SUITS, type Card } from '$lib/setup';
  import { passInstruction } from '$lib/passing';

  let connection: 'checking' | 'synced' | 'error' = 'checking';
  let connectionLabel = 'Checking Firebase…';
  let displayName = '';
  let inviteCode = '';
  let activeGameId = '';
  let game: GameProjection | null = null;
  let actionError = '';
  let unsubscribe = () => {};
  let currentUid = '';
  let selectedPrincess = '';
  let selectedRounds: string[] = [];
  let selectedPassCards: string[] = [];

  const build = import.meta.env.VITE_GIT_HASH ?? 'local';

  onMount(() => {
    void (async () => {
      try {
        const e2eUid = new URL(location.href).searchParams.get('e2eUid') ?? undefined;
        const target = await probeFirebase(e2eUid);
        currentUid = (await ensureAnonymousIdentity(e2eUid)).uid;
        connection = 'synced';
        connectionLabel = target === 'emulator' ? 'Firebase emulator ready' : 'Firebase ready';
        const gameId = normalizeGameId(new URL(location.href).searchParams.get('game') ?? '');
        if (gameId) watchGame(gameId);
      } catch {
        connection = 'error';
        connectionLabel = 'Firebase unavailable';
      }
    })();
    return () => unsubscribe();
  });

  function watchGame(gameId: string) {
    unsubscribe();
    activeGameId = gameId;
    const parameters = new URL(location.href).searchParams;
    parameters.set('game', gameId);
    parameters.delete('gameId');
    replaceState(`?${parameters.toString()}`, {});
    unsubscribe = subscribeToGame(firebaseDatabase(), gameId, (next) => {
      game = next;
      connection = 'synced';
      connectionLabel = 'Game synchronized';
    }, () => {
      connection = 'error';
      connectionLabel = 'Synchronization failed';
    });
  }

  async function createGame() {
    await enterGame('game/created', normalizeGameId(new URL(location.href).searchParams.get('gameId') ?? '') ||
      crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase());
  }

  async function joinGame() {
    await enterGame('player/joined', normalizeGameId(inviteCode));
  }

  async function enterGame(type: 'game/created' | 'player/joined', gameId: string) {
    actionError = '';
    const name = displayName.trim();
    if (!name || !gameId) {
      actionError = 'Enter your name and a valid room code.';
      return;
    }
    connection = 'checking';
    connectionLabel = type === 'game/created' ? 'Creating room…' : 'Joining room…';
    try {
      const user = await ensureAnonymousIdentity(new URL(location.href).searchParams.get('e2eUid') ?? undefined);
      currentUid = user.uid;
      if (type === 'player/joined') {
        const existing = await loadGame(firebaseDatabase(), gameId);
        if (existing.players.length === 0) throw new Error('Game not found');
        if (existing.players.length >= 6 && !existing.players.some((player) => player.uid === user.uid)) throw new Error('Game is full');
      }
      await appendGameEvent(firebaseDatabase(), gameId, user.uid, type, { displayName: name });
      watchGame(gameId);
    } catch {
      connection = 'error';
      connectionLabel = 'Could not update the room';
      actionError = 'The room could not be updated. Please try again.';
    }
  }

  async function becomeReady() {
    if (!selectedPrincess || !game || game.players.some((player) => player.uid !== currentUid && player.princessId === selectedPrincess)) return;
    connection = 'checking';
    connectionLabel = 'Saving your Princess…';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'player/configured', {
      princessId: selectedPrincess,
      ready: true
    });
  }

  function toggleRound(roundId: string) {
    selectedRounds = selectedRounds.includes(roundId)
      ? selectedRounds.filter((id) => id !== roundId)
      : selectedRounds.length < 5 ? [...selectedRounds, roundId] : selectedRounds;
  }

  async function dealCards() {
    if (!game || game.players.length < 3 || game.players.length > 6 || !game.players.every((player) => player.ready) || selectedRounds.length !== 5) return;
    const seed = new URL(location.href).searchParams.get('seed') ?? crypto.randomUUID();
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'game/dealt', {
      seed,
      roundIds: selectedRounds,
      hands: dealForPlayers(game.players.map((player) => player.uid), seed)
    });
  }

  function princessName(id?: string) { return PRINCESSES.find(([key]) => key === id)?.[1] ?? 'Choosing…'; }
  function roundName(id: string) { return ROUND_RULES.find(([key]) => key === id)?.[1] ?? id; }
  function suitIndex(card: Card) { return SUITS.indexOf(card.suit); }
  function roundStyle(id: string) {
    const index = Math.max(0, ROUND_RULES.findIndex(([key]) => key === id));
    return `--round-x: ${(index % 7) * 100 / 6}%; --round-y: ${Math.floor(index / 7) * 50}%; background-image: url(${roundAtlas})`;
  }

  function passRecipient(): string {
    if (!game) return '';
    const instruction = passInstruction(game.roundIds[0]);
    const index = game.players.findIndex((player) => player.uid === currentUid);
    const left = game.players[(index + 1) % game.players.length].displayName;
    const right = game.players[(index - 1 + game.players.length) % game.players.length].displayName;
    return instruction.direction === 'left' ? left : instruction.direction === 'right' ? right : `${left} and ${right}`;
  }
  function waitingForPasses(): string {
    const count = game?.players.filter((player) => !game?.passSubmissions[player.uid]).length ?? 0;
    return `Waiting for ${count} other ${count === 1 ? 'player' : 'players'}.`;
  }

  function togglePassCard(card: Card) {
    if (!game || game.passComplete || game.passSubmissions[currentUid]) return;
    const label = cardLabel(card);
    const required = passInstruction(game.roundIds[0]).count;
    selectedPassCards = selectedPassCards.includes(label)
      ? selectedPassCards.filter((entry) => entry !== label)
      : selectedPassCards.length < required ? [...selectedPassCards, label] : selectedPassCards;
  }

  async function submitPass() {
    if (!game?.hands || game.passComplete || game.passSubmissions[currentUid]) return;
    const instruction = passInstruction(game.roundIds[0]);
    const cards = game.hands[currentUid].filter((card) => selectedPassCards.includes(cardLabel(card)));
    if (cards.length !== instruction.count) return;
    connection = 'checking';
    connectionLabel = 'Submitting cards…';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'pass/submitted', { cards });
  }

  async function reclaimPassCard(card: Card) {
    const committed = game?.passSubmissions[currentUid];
    if (!committed || game?.passComplete || !committed.some((entry) => cardLabel(entry) === cardLabel(card))) return;
    selectedPassCards = committed.map(cardLabel).filter((label) => label !== cardLabel(card));
    connection = 'checking';
    connectionLabel = 'Reclaiming cards…';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'pass/retracted', {});
  }

  function handleHandCard(card: Card) {
    if (game?.passSubmissions[currentUid]) void reclaimPassCard(card);
    else togglePassCard(card);
  }
</script>

<svelte:head>
  <title>Rebel Princess — Live card play</title>
</svelte:head>

<main class:gameplay={Boolean(game?.hands)} data-e2e-layout>
  <header class="masthead">
    <a class="wordmark" href="./" aria-label="Rebel Princess home">
      <span>Rebel</span>
      <strong>Princess</strong>
    </a>
    <div class="status" role="status" aria-live="polite" data-status={connection}>
      <span class="status-dot" aria-hidden="true"></span>
      {connectionLabel}
    </div>
  </header>

  <section class="hero" class:dealt={Boolean(game?.hands)} aria-labelledby="hero-title">
    <div class="copy">
      <p class="eyebrow">Five nights. Four suits. Zero unwanted proposals.</p>
      <h1 id="hero-title">The ball is almost ready.</h1>
      <p class="lede">
        A live trick-taking game for three to six fiercely independent princesses.
        Create a room, invite the court, and keep those princes at arm's length.
      </p>
      {#if activeGameId && game?.hands}
        <section class="table" aria-label="Dealt game">
          <div class="table-board">
            <div class="opponents" aria-label="Opponents">
              {#each game.players.filter((player) => player.uid !== currentUid) as player, index}
                <section class="opponent-seat" class:seat-0={index === 0} class:seat-1={index === 1} class:seat-2={index === 2} class:seat-3={index === 3} class:seat-4={index === 4} aria-label={`${player.displayName}'s hand`}>
                  <strong>{player.displayName} · {game.hands[player.uid]?.length ?? 0}</strong>
                  <div class="card-backs" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                </section>
              {/each}
            </div>

            <article class="round-center" aria-label="Current Round card">
              <div class="round-art" style={roundStyle(game.roundIds[0])}></div>
              <p>Round 1 of 5</p>
              <h2>{roundName(game.roundIds[0])}</h2>
            </article>

            <section class="local-seat" aria-label="Your seat">
              <div class="local-heading"><strong>{game.players.find((player) => player.uid === currentUid)?.displayName} · You</strong><span>{game.hands[currentUid]?.length ?? 0} cards</span></div>
              <div class="hand" role="region" aria-label="Your hand">
                {#each game.hands[currentUid] ?? [] as card}
                  {@const committed = game.passSubmissions[currentUid]?.some((entry) => cardLabel(entry) === cardLabel(card))}
                  <button type="button" class="playing-card" class:selected={selectedPassCards.includes(cardLabel(card))} class:committed disabled={game.passComplete || Boolean(game.passSubmissions[currentUid] && !committed)} aria-label={cardLabel(card)} on:click={() => handleHandCard(card)}>
                    <div class="card-art" style={`--suit-index: ${suitIndex(card)}; background-image: url(${suitAtlas})`}></div>
                    <strong>{card.rank}</strong><small>{card.suit}</small>
                    {#if committed}<em>To {passRecipient()}</em>{/if}
                  </button>
                {/each}
              </div>
              <div class="pass-controls">
                {#if game.passComplete}
                  <p class="pass-complete" role="alert">Passing complete · all {Object.values(game.hands).flat().length} cards accounted for</p>
                {:else if game.passSubmissions[currentUid]}
                  <p class="pass-waiting" role="alert">Passing {game.passSubmissions[currentUid].length} {passInstruction(game.roundIds[0]).direction} to {passRecipient()} · {waitingForPasses()} Select a raised card to take it back.</p>
                {:else}
                  {@const instruction = passInstruction(game.roundIds[0])}
                  <button class="pass-submit" type="button" disabled={selectedPassCards.length !== instruction.count} on:click={submitPass}>Pass {instruction.count} {instruction.direction} to {passRecipient()}</button>
                {/if}
              </div>
            </section>
          </div>
          <span class="sr-only" data-testid="stream-card-count">Shared stream contains {Object.values(game.hands).flat().length} cards</span>
        </section>
      {:else if activeGameId}
        <section class="room" aria-label="Game room">
          <p class="room-label">Room code</p>
          <div class="room-code" data-testid="invite-code">{activeGameId}</div>
          <h2>Players · {game?.players.length ?? 0}</h2>
          <ul aria-label="Players">
            {#each game?.players ?? [] as player (player.uid)}
              <li><span>{player.displayName} · {princessName(player.princessId)}</span><span>{#if player.host}<small>Host</small>{/if} {player.ready ? 'Ready' : 'Waiting'}</span></li>
            {/each}
          </ul>
          {#if !game?.players.find((player) => player.uid === currentUid)?.ready}
            <fieldset class="choice-grid">
              <legend>Choose your Princess</legend>
              {#each PRINCESSES as princess}
                <button type="button" class:chosen={selectedPrincess === princess[0]} disabled={game?.players.some((player) => player.uid !== currentUid && player.princessId === princess[0])} on:click={() => selectedPrincess = princess[0]}>{princess[1]}</button>
              {/each}
            </fieldset>
            <button type="button" disabled={!selectedPrincess} on:click={becomeReady}>Ready for the ball</button>
          {/if}
          {#if game?.players[0]?.uid === currentUid}
            <fieldset class="choice-grid rounds">
              <legend>Choose five Round cards · {selectedRounds.length}/5</legend>
              {#each ROUND_RULES as round}
                <button type="button" class:chosen={selectedRounds.includes(round[0])} on:click={() => toggleRound(round[0])}>{round[1]}</button>
              {/each}
            </fieldset>
            <button type="button" disabled={game.players.length < 3 || !game.players.every((player) => player.ready) || selectedRounds.length !== 5} on:click={dealCards}>Shuffle and deal</button>
          {/if}
          <p class="waiting">Three to six players. The guest list updates live.</p>
        </section>
      {:else}
        <form class="room-form" on:submit|preventDefault={createGame}>
          <label for="display-name">Your name</label>
          <input id="display-name" bind:value={displayName} maxlength="30" autocomplete="nickname" placeholder="Princess name" />
          <div class="actions">
            <button type="submit">Create a game</button>
            <span>or</span>
            <label class="sr-only" for="invite-code">Room code</label>
            <input id="invite-code" bind:value={inviteCode} maxlength="8" placeholder="ROOM CODE" />
            <button class="secondary" type="button" on:click={joinGame}>Join</button>
          </div>
          {#if actionError}<p class="form-error" role="alert">{actionError}</p>{/if}
        </form>
      {/if}
    </div>

    {#if !game?.hands}<figure class="atlas-card">
      <img
        src={suitAtlas}
        alt="Original card illustrations for Fairies, Queens, Princes, and Pets"
      />
      <figcaption>
        <span>Fairies</span><span>Queens</span><span>Princes</span><span>Pets</span>
      </figcaption>
    </figure>{/if}
  </section>

  <section class="promise" aria-label="Game principles">
    <article>
      <span class="number">01</span>
      <h2>Play together</h2>
      <p>One room stays synchronized across every phone, tablet, and laptop.</p>
    </article>
    <article>
      <span class="number">02</span>
      <h2>Trust the table</h2>
      <p>The client shows the right hand while friends share one event history.</p>
    </article>
    <article>
      <span class="number">03</span>
      <h2>Rewrite the tale</h2>
      <p>Princess powers and changing round rules make every ball play differently.</p>
    </article>
  </section>

  <footer>
    <span>GPLv3 · Original artwork</span>
    <span data-testid="build-marker">Build {build}</span>
  </footer>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    color-scheme: dark;
    background: #140d1e;
    font-family: 'Atkinson Hyperlegible', sans-serif;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    background:
      radial-gradient(circle at 77% 9%, rgba(149, 91, 184, 0.25), transparent 31rem),
      linear-gradient(145deg, #160e22 0%, #251638 48%, #101c24 100%);
  }

  :global(button),
  :global(a) {
    font: inherit;
  }

  main {
    width: min(1180px, calc(100% - 48px));
    min-height: 100vh;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  .masthead {
    min-height: 104px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 239, 199, 0.22);
  }

  .wordmark {
    color: #fff4d0;
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    text-decoration: none;
    letter-spacing: 0.01em;
  }

  .wordmark strong {
    color: #ffc75f;
    font-size: 35px;
  }

  .status {
    color: #d8d1dc;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
  }

  .status-dot {
    width: 9px;
    height: 9px;
    border: 1px solid #ffe2a3;
    border-radius: 50%;
    background: #816f8d;
  }

  [data-status='synced'] .status-dot {
    background: #7de2a7;
    box-shadow: 0 0 0 4px rgba(125, 226, 167, 0.12);
  }

  [data-status='error'] .status-dot {
    background: #ff7b75;
  }

  .hero {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 0.88fr) minmax(460px, 1.12fr);
    align-items: center;
    gap: clamp(38px, 7vw, 92px);
    padding: 72px 0 64px;
  }
  .hero.dealt { grid-template-columns: 1fr; }

  .copy {
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    margin: 0 0 18px;
    color: #ffc75f;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 600px;
    margin: 0;
    color: #fff5dc;
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(54px, 6.3vw, 88px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.88;
  }

  .lede {
    max-width: 520px;
    margin: 28px 0 0;
    color: #cfc4d4;
    font-size: 18px;
    line-height: 1.55;
  }

  .actions {
    margin-top: 34px;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  button {
    min-height: 48px;
    padding: 0 23px;
    border: 1px solid rgba(255, 226, 163, 0.38);
    border-radius: 3px;
    color: #271631;
    background: #ffc75f;
    font-weight: 700;
  }

  input {
    min-width: 0;
    min-height: 46px;
    padding: 0 13px;
    border: 1px solid rgba(255, 226, 163, 0.38);
    border-radius: 3px;
    color: #fff5dc;
    background: rgba(13, 8, 20, 0.7);
    font: inherit;
  }

  input:focus { outline: 2px solid #b88cdf; outline-offset: 2px; }
  .room-form { margin-top: 28px; }
  .room-form > label { display: block; margin-bottom: 7px; color: #e4d8e5; font-size: 13px; }
  .room-form > input { width: min(100%, 330px); }
  .actions { flex-wrap: wrap; }
  .actions input { width: 132px; text-transform: uppercase; }
  .actions > span { color: #9f93a5; }
  button.secondary { color: #fff4d0; background: transparent; }
  .form-error { color: #ffaaa5; font-size: 13px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

  .room { max-width: 420px; margin-top: 28px; padding: 20px; border: 1px solid rgba(255, 226, 163, 0.32); background: rgba(13, 8, 20, 0.5); }
  .room-label { margin: 0; color: #b6a7ba; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
  .room-code { margin: 2px 0 16px; color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 700; letter-spacing: .12em; }
  .room h2 { border-bottom: 1px solid rgba(255, 239, 199, 0.16); padding-bottom: 8px; }
  .room ul { margin: 0; padding: 0; list-style: none; }
  .room li { display: flex; justify-content: space-between; padding: 7px 0; color: #fff5dc; }
  .room small { color: #b88cdf; text-transform: uppercase; letter-spacing: .1em; }
  .waiting { margin: 12px 0 0; color: #9f93a5; font-size: 13px; }

  fieldset { min-width: 0; margin: 18px 0; padding: 0; border: 0; }
  legend { margin-bottom: 8px; color: #ffc75f; font-size: 13px; font-weight: 700; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .choice-grid legend { grid-column: 1 / -1; }
  .choice-grid button { min-height: 34px; padding: 5px 7px; color: #d9cedd; background: rgba(50, 31, 62, .7); font-size: 11px; }
  .choice-grid button.chosen { border-color: #ffc75f; color: #211329; background: #ffc75f; }
  .choice-grid button:disabled { opacity: .35; }
  .rounds { max-height: 164px; padding-right: 3px; overflow-y: auto; }

  .table { width: 100%; height: 100%; }
  .table-board { position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid rgba(255, 226, 163, .2); border-radius: 18px; background: radial-gradient(ellipse at center, rgba(75, 44, 91, .72), rgba(19, 25, 35, .88) 70%); box-shadow: inset 0 0 90px rgba(0, 0, 0, .35); }
  .round-center { position: absolute; top: 45%; left: 50%; width: clamp(112px, 14vh, 148px); margin: 0; transform: translate(-50%, -50%); text-align: center; }
  .round-art { width: 72%; aspect-ratio: .855; margin: 0 auto 5px; border: 1px solid rgba(255, 226, 163, .5); border-radius: 7px; background-size: 700% 300%; background-position: var(--round-x) var(--round-y); box-shadow: 0 10px 25px rgba(0, 0, 0, .45); }
  .round-center p { margin: 0; color: #b88cdf; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .round-center h2 { margin: 2px 0 0; font-size: clamp(15px, 2.3vh, 22px); line-height: 1; }
  .opponent-seat { position: absolute; z-index: 2; min-width: 105px; color: #e9deeb; text-align: center; }
  .opponent-seat > strong { display: block; margin-bottom: 4px; font-size: 12px; }
  .seat-0 { top: 12px; left: 18%; }
  .seat-1 { top: 12px; right: 18%; }
  .seat-2 { top: 34%; left: 12px; }
  .seat-3 { top: 34%; right: 12px; }
  .seat-4 { top: 12px; left: 50%; transform: translateX(-50%); }
  .card-backs { display: flex; justify-content: center; height: 46px; }
  .card-backs i { width: 30px; height: 44px; margin-left: -18px; border: 1px solid #b88cdf; border-radius: 3px; background: repeating-linear-gradient(135deg, #251638 0 4px, #604077 4px 6px); box-shadow: 0 3px 7px rgba(0, 0, 0, .35); }
  .card-backs i:first-child { margin-left: 0; }
  .local-seat { position: absolute; z-index: 3; inset: auto 8px 8px; }
  .local-heading { display: flex; justify-content: center; gap: 12px; margin-bottom: 5px; color: #fff4d0; font-size: 12px; }
  .local-heading span { color: #b88cdf; }
  .hand { display: flex; justify-content: center; align-items: flex-end; min-height: clamp(78px, 15vh, 145px); padding-top: 8px; }
  .playing-card { position: relative; width: clamp(50px, 6.3vw, 78px); height: clamp(76px, 14vh, 120px); min-height: 0; padding: 0; overflow: hidden; flex: 0 0 auto; border: 1px solid rgba(255, 226, 163, .5); border-radius: 5px; background: #150d1d; transition: transform .15s ease; }
  .playing-card + .playing-card { margin-left: clamp(-27px, -1.8vw, -12px); }
  .playing-card:not(:disabled) { cursor: pointer; }
  .playing-card.selected, .playing-card.committed { z-index: 2; border: 3px solid #ffc75f; transform: translateY(-9px); box-shadow: 0 7px 18px rgba(0, 0, 0, .45); }
  .playing-card.committed { border-color: #7de2a7; }
  .playing-card:disabled { opacity: 1; color: inherit; }
  .playing-card strong { position: absolute; top: 4px; left: 7px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 25px; text-shadow: 0 1px 3px #000; }
  .playing-card small { position: absolute; inset: auto 4px 4px; color: #fff4d0; font-size: 9px; text-align: center; text-transform: capitalize; text-shadow: 0 1px 3px #000; }
  .playing-card em { position: absolute; z-index: 2; inset: auto 0 0; padding: 3px 1px; color: #102019; background: #7de2a7; font-size: 8px; font-style: normal; }
  .card-art { position: absolute; inset: 0; opacity: .72; background-size: 400% 100%; background-position: calc(var(--suit-index) * -100% / 3) center; }
  .pass-controls { min-height: 37px; display: flex; justify-content: center; align-items: center; }
  .pass-submit { min-height: 32px; padding: 0 15px; font-size: 12px; }
  .pass-waiting, .pass-complete { margin: 0; color: #d9cedd; font-size: 11px; text-align: center; }
  .pass-complete { color: #7de2a7; font-weight: 700; }

  main.gameplay { width: calc(100% - 24px); height: 100dvh; min-height: 0; overflow: hidden; }
  main.gameplay .masthead { min-height: 54px; height: 54px; }
  main.gameplay .wordmark { font-size: 18px; }
  main.gameplay .wordmark strong { font-size: 24px; }
  main.gameplay .hero.dealt { height: calc(100dvh - 54px); min-height: 0; padding: 8px 0 10px; }
  main.gameplay .copy { height: 100%; }
  main.gameplay .eyebrow, main.gameplay h1, main.gameplay .lede, main.gameplay .promise, main.gameplay footer { display: none; }
  :global(body:has(main.gameplay)) { height: 100dvh; overflow: hidden; }

  .actions span {
    max-width: 180px;
    color: #9f93a5;
    font-size: 13px;
    line-height: 1.35;
  }

  .atlas-card {
    position: relative;
    margin: 0;
    border: 1px solid rgba(255, 226, 163, 0.35);
    border-radius: 12px;
    overflow: hidden;
    background: #09070c;
    box-shadow: 0 36px 80px rgba(0, 0, 0, 0.45);
    transform: rotate(1.2deg);
  }

  .atlas-card::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 80px rgba(8, 4, 15, 0.45);
  }

  .atlas-card img {
    display: block;
    width: 100%;
    aspect-ratio: 1.874 / 1;
    object-fit: cover;
  }

  figcaption {
    position: absolute;
    inset: auto 0 0;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 12px 10px 10px;
    color: #fff6da;
    background: linear-gradient(transparent, rgba(6, 5, 8, 0.9));
    font-family: 'Cormorant Garamond', serif;
    font-size: 17px;
    text-align: center;
  }

  .promise {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid rgba(255, 239, 199, 0.22);
    border-bottom: 1px solid rgba(255, 239, 199, 0.22);
  }

  .promise article {
    padding: 30px clamp(20px, 3vw, 40px) 32px;
  }

  .promise article + article {
    border-left: 1px solid rgba(255, 239, 199, 0.16);
  }

  .number {
    color: #b88cdf;
    font-size: 12px;
    font-weight: 700;
  }

  h2 {
    margin: 7px 0 6px;
    color: #f9edcf;
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
  }

  .promise p {
    margin: 0;
    color: #a99dac;
    font-size: 14px;
    line-height: 1.45;
  }

  footer {
    min-height: 74px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #7f7485;
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  @media (max-width: 760px) {
    main {
      width: min(100% - 28px, 520px);
    }

    .masthead {
      min-height: 76px;
      align-items: flex-start;
      padding-top: 14px;
    }

    .wordmark {
      flex-direction: column;
      gap: 0;
      font-size: 16px;
      line-height: 0.85;
    }

    .wordmark strong {
      font-size: 27px;
    }

    .status {
      padding-top: 9px;
      font-size: 12px;
    }

    .hero {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 30px;
      padding: 36px 0 32px;
    }

    .eyebrow {
      max-width: 290px;
      margin-bottom: 14px;
      font-size: 11px;
      line-height: 1.4;
    }

    h1 {
      max-width: 350px;
      font-size: clamp(48px, 15vw, 64px);
    }

    .lede {
      margin-top: 19px;
      font-size: 15px;
      line-height: 1.48;
    }

    .actions {
      margin-top: 23px;
      gap: 12px;
    }

    .actions input { width: 118px; }
    .room { max-width: none; padding: 15px; }
    .hand { grid-template-columns: repeat(4, minmax(44px, 1fr)); }
    .playing-card { min-height: 92px; }
    main.gameplay .hand { min-height: 82px; }
    main.gameplay .playing-card { height: 76px; min-height: 0; }
    main.gameplay .playing-card { width: 44px; }
    main.gameplay .playing-card + .playing-card { margin-left: -15px; }
    main.gameplay .local-seat { bottom: 2px; }
    main.gameplay .round-center { top: 43%; }

    button {
      min-height: 44px;
      padding: 0 16px;
      font-size: 14px;
    }

    .actions span {
      max-width: 155px;
      font-size: 11px;
    }

    .atlas-card {
      transform: none;
    }

    figcaption {
      padding-bottom: 7px;
      font-size: 12px;
    }

    .promise {
      display: block;
    }

    .promise article {
      display: grid;
      grid-template-columns: 28px 1fr;
      padding: 17px 4px;
    }

    .promise article + article {
      border-top: 1px solid rgba(255, 239, 199, 0.16);
      border-left: 0;
    }

    .number {
      grid-row: 1 / 3;
      padding-top: 5px;
    }

    h2 {
      margin: 0 0 2px;
      font-size: 20px;
    }

    .promise p {
      font-size: 12px;
    }

    footer {
      min-height: 58px;
    }
  }
</style>
