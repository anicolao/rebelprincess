<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import GameLobby from '$lib/components/GameLobby.svelte';
  import GameCardFace from '$lib/components/GameCardFace.svelte';
  import GameMasthead from '$lib/components/GameMasthead.svelte';
  import GameRoundDisplay from '$lib/components/GameRoundDisplay.svelte';
  import GameTableSurface from '$lib/components/GameTableSurface.svelte';
  import { choiceCommitment, princessChoiceScope } from '$lib/choice-commitment';
  import { ensureAnonymousIdentity, firebaseDatabase, probeFirebase } from '$lib/firebase';
  import { appendGameEvent, normalizeGameId } from '$lib/game-events';
  import { cardLabel, type Card } from '$lib/setup';
  import { subscribeToZombieGame, type ZombieProjection } from '$lib/zombie-game-events';
  import type { LobbyPlayer, LobbyPrincess } from '$lib/game-ui';
  import {
    ZOMBIE_ROUND_IDS,
    zombieCardLabel,
    zombieDeal,
    zombieLegalCards,
    zombiePassInstruction,
    zombiePrincess,
    zombieRound,
    zombieSuitFolder,
    zombieSuitName
  } from '$lib/zombie';

  const artModules = import.meta.glob('../../../assets/zombie/{playing,princesses,rounds}/**/*.jpg', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;

  function art(path: string) {
    return artModules[`../../../assets/zombie/${path}`] ?? '';
  }

  let game: ZombieProjection | null = null;
  let gameId = '';
  let currentUid = '';
  let connection: 'checking' | 'synced' | 'error' = 'checking';
  let connectionLabel = 'Connecting…';
  let actionError = '';
  let selectedPrincess = '';
  let selectedPassCards: string[] = [];
  let bidValue = 0;
  let changedBidValue = 0;
  let armedPower = '';
  let redOffer = '';
  let dealPending = false;
  let unsubscribe = () => {};
  const submittedReveals = new Set<string>();

  onMount(() => {
    void (async () => {
      try {
        const parameters = new URL(location.href).searchParams;
        gameId = normalizeGameId(parameters.get('game') ?? '');
        if (!gameId) {
          await goto(`${base}/`);
          return;
        }
        const e2eUid = parameters.get('e2eUid') ?? undefined;
        await probeFirebase(e2eUid);
        currentUid = (await ensureAnonymousIdentity(e2eUid)).uid;
        unsubscribe = subscribeToZombieGame(firebaseDatabase(), gameId, (projection) => {
          game = projection;
          dealPending = false;
          connection = 'synced';
          connectionLabel = 'Game synchronized';
          void revealPrincess(projection);
        }, () => {
          connection = 'error';
          connectionLabel = 'Synchronization failed';
        });
      } catch {
        connection = 'error';
        connectionLabel = 'Firebase unavailable';
      }
    })();
    return () => unsubscribe();
  });

  type StoredChoice = { choice: string; nonce: string };
  function choiceKey(uid: string) { return `zombie-princess:choice:${gameId}:${uid}`; }

  async function revealPrincess(projection: ZombieProjection) {
    if (!currentUid || projection.players.length < 3 || projection.players.find((player) => player.uid === currentUid)?.ready || !projection.princessCommitments[currentUid] || !projection.players.every((player) => projection.princessCommitments[player.uid])) return;
    const key = choiceKey(currentUid);
    if (submittedReveals.has(key)) return;
    let stored: StoredChoice | null = null;
    try { stored = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { stored = null; }
    if (!stored || choiceCommitment(princessChoiceScope(gameId, 0, currentUid), stored.choice, stored.nonce) !== projection.princessCommitments[currentUid]) {
      actionError = 'Your sealed Princess choice is unavailable in this browser.';
      return;
    }
    submittedReveals.add(key);
    try {
      await appendGameEvent(firebaseDatabase(), gameId, currentUid, 'player/configured', { princessId: stored.choice, nonce: stored.nonce, ready: true });
    } catch {
      submittedReveals.delete(key);
    }
  }

  async function choosePrincess() {
    if (!game || !selectedPrincess || game.princessCommitments[currentUid]) return;
    const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    localStorage.setItem(choiceKey(currentUid), JSON.stringify({ choice: selectedPrincess, nonce } satisfies StoredChoice));
    await act('player/princess-committed', {
      commitment: choiceCommitment(princessChoiceScope(gameId, 0, currentUid), selectedPrincess, nonce)
    });
  }

  async function act(type: Parameters<typeof appendGameEvent>[3], payload: Parameters<typeof appendGameEvent>[4]) {
    actionError = '';
    connection = 'checking';
    try {
      await appendGameEvent(firebaseDatabase(), gameId, currentUid, type, payload);
    } catch {
      connection = 'error';
      connectionLabel = 'Action failed';
      actionError = 'That action could not be saved. Please try again.';
    }
  }

  async function dealRound() {
    if (!game || dealPending || game.players[0]?.uid !== currentUid || !game.players.every((player) => player.ready)) return;
    dealPending = true;
    const seed = crypto.randomUUID();
    await act('game/dealt', {
      seed,
      roundIds: game.roundIds.length === 4 ? game.roundIds : [...ZOMBIE_ROUND_IDS],
      hands: zombieDeal(game.players.map((player) => player.uid), `${gameId}:${game.roundIndex}:${seed}`)
    });
  }

  function localPlayer() { return game?.players.find((player) => player.uid === currentUid); }
  function playerName(uid?: string | null) { return game?.players.find((player) => player.uid === uid)?.displayName ?? 'another player'; }
  function localHand() { return game?.hands?.[currentUid] ?? []; }
  function activeRound() { return zombieRound(game?.activeRoundId ?? 'a'); }

  function cardArt(card: Card) {
    return art(`playing/${zombieSuitFolder(card.suit)}/${String(card.rank).padStart(2, '0')}.jpg`);
  }

  function princessArt(id?: string) { return id ? art(`princesses/${id}.jpg`) : ''; }
  function roundArt() { return art(`rounds/${activeRound().art}`); }

  function togglePass(card: Card) {
    if (!game || game.phase !== 'pass' || game.passSubmissions[currentUid]) return;
    const label = cardLabel(card);
    const count = zombiePassInstruction(game.activeRoundId).count;
    selectedPassCards = selectedPassCards.includes(label)
      ? selectedPassCards.filter((entry) => entry !== label)
      : selectedPassCards.length < count ? [...selectedPassCards, label] : selectedPassCards;
  }

  async function submitPass() {
    if (!game || game.phase !== 'pass' || game.passSubmissions[currentUid]) return;
    const cards = localHand().filter((card) => selectedPassCards.includes(cardLabel(card)));
    if (cards.length !== zombiePassInstruction(game.activeRoundId).count) return;
    await act('pass/submitted', { cards });
  }

  async function retractPass() {
    if (!game?.passSubmissions[currentUid] || game.phase !== 'pass') return;
    selectedPassCards = game.passSubmissions[currentUid].map(cardLabel);
    await act('pass/retracted', {});
  }

  async function setAside(card: Card) {
    if (game?.phase !== 'set-aside' || game.setAsideCards[currentUid]) return;
    await act('round/card-set-aside', { card });
  }

  async function placeBid() {
    if (game?.phase !== 'bid' || game.currentBidderUid !== currentUid) return;
    await act('zombie/bid-placed', { bid: Math.max(0, Math.min(15, Number(bidValue))) });
  }

  function legal(card: Card) {
    if (!game?.hands || game.phase !== 'play' || game.currentTurnUid !== currentUid || !game.trick) return false;
    const princessId = localPlayer()?.princessId;
    return zombieLegalCards(localHand(), game.trick.plays, game.princesBroken, princessId === 'cinderella', armedPower === 'thumbelina')
      .some((candidate) => cardLabel(candidate) === cardLabel(card));
  }

  async function play(card: Card) {
    if (!legal(card)) return;
    if (armedPower === 'pea-princess' || armedPower === 'thumbelina') {
      await act('power/activated', { powerId: armedPower, card });
      armedPower = '';
    }
    await act('card/played', { card });
  }

  function powerAvailable(id?: string) {
    return Boolean(id && game?.phase === 'play' && !game.exhaustedPrincessUids.includes(currentUid) && !zombiePrincess(id)?.always);
  }

  async function useIcePrincess() {
    if (!game || !powerAvailable('ice-princess') || game.trick?.plays.length || (game.effectiveBids[currentUid] ?? 0) < 1) return;
    await act('power/activated', { powerId: 'ice-princess' });
  }

  async function useDorothy() {
    const last = game?.capturedTricks[currentUid]?.at(-1);
    if (!powerAvailable('dorothy') || !last || last.index !== (game?.completedTricks ?? 0) - 1) return;
    await act('power/activated', { powerId: 'dorothy', targetTrickIndex: last.index });
  }

  async function changeBid() {
    if (!powerAvailable('scheherazade') || game?.completedTricks !== 3 || game.trick?.plays.length) return;
    await act('power/activated', { powerId: 'scheherazade', bid: Math.max(0, Math.min(15, Number(changedBidValue))) });
  }

  async function redSwap(taken: Card) {
    const offered = localHand().find((card) => cardLabel(card) === redOffer);
    if (!offered || !powerAvailable('red-riding-hood') || taken.suit === 'princes') return;
    await act('power/activated', { powerId: 'red-riding-hood', cards: [offered, taken] });
    redOffer = '';
  }

  async function frogDecision(counts: boolean) {
    if (game?.phase !== 'frog' || game.frogOwnerUid !== currentUid || game.frogTrickIndex === null) return;
    await act('zombie/frog-decided', { targetTrickIndex: game.frogTrickIndex, counts });
  }

  async function scoreDecision(buyTricks: number) {
    if (game?.phase !== 'score' || !game.scoreDecisionUids.includes(currentUid) || game.scoreDecisions[currentUid] !== undefined) return;
    await act('zombie/score-decided', { buyTricks });
  }

  function missingTricks() {
    if (!game) return 0;
    return Math.max(0, (game.effectiveBids[currentUid] ?? 0) - (game.countedTricks[currentUid] ?? 0));
  }

  function handCardDisabled(card: Card) {
    if (!game) return true;
    if (game.phase === 'pass') return Boolean(game.passSubmissions[currentUid]);
    if (game.phase === 'set-aside') return Boolean(game.setAsideCards[currentUid]);
    if (game.phase === 'play' && localPlayer()?.princessId === 'red-riding-hood' && redOffer === '' && powerAvailable('red-riding-hood') && game.capturedTricks[currentUid]?.length) return false;
    if (game.phase === 'play') return !legal(card);
    return true;
  }

  function handleHandCard(card: Card) {
    if (game?.phase === 'pass') togglePass(card);
    else if (game?.phase === 'set-aside') void setAside(card);
    else if (localPlayer()?.princessId === 'red-riding-hood' && redOffer === '' && powerAvailable('red-riding-hood')) redOffer = cardLabel(card);
    else void play(card);
  }

  function winnerNames() {
    return game?.winnerUids.map((uid) => playerName(uid)).join(' and ') ?? '';
  }

  function lobbyPlayers(): LobbyPlayer[] {
    return game?.players.map((player) => ({
      ...player,
      committed: Boolean(game?.princessCommitments[player.uid]),
      princessName: zombiePrincess(player.princessId)?.name
    })) ?? [];
  }

  function lobbyPrincesses(): LobbyPrincess[] {
    return (game?.princessOptions[currentUid] ?? []).map((id) => {
      const princess = zombiePrincess(id)!;
      return {
        id,
        name: princess.name,
        power: princess.power,
        text: princess.text,
        artwork: { kind: 'image' as const, src: princessArt(id), alt: princess.name }
      };
    });
  }
</script>

<svelte:head>
  <title>Zombie Princess — Live playtest</title>
  <meta name="description" content="Play the Zombie Princess variant in a synchronized room." />
</svelte:head>

<main class:gameplay={Boolean(game?.hands)} data-e2e-layout>
  <GameMasthead homeHref={`${base}/`} brand="Zombie Princess" assetsHref={`${base}/zombie/assets/`} assetsLabel="Asset review" {connection} {connectionLabel} compact={Boolean(game?.hands)} />

  {#if !game}
    <section class="loading"><h1>Opening the room…</h1>{#if actionError}<p role="alert">{actionError}</p>{/if}</section>
  {:else if game.phase === 'lobby'}
    <div class="shared-lobby">
      <GameLobby
        {gameId}
        gameName="Zombie Princess"
        players={lobbyPlayers()}
        {currentUid}
        princessOptions={lobbyPrincesses()}
        {selectedPrincess}
        {dealPending}
        lockLabel="Lock Princess"
        dealLabel={`Deal round ${game.roundIndex + 1}`}
        automaticText="Individual play · recommended A–D rounds"
        {actionError}
        onSelect={(id) => selectedPrincess = id}
        onLock={choosePrincess}
        onDeal={dealRound}
      />
    </div>
  {:else}
    <section class="game-shell">
      <div class="round-head">
        <GameRoundDisplay name={activeRound().name} rule={activeRound().text} artwork={{ kind: 'image', src: roundArt(), alt: `${activeRound().name} round card` }} current={game.roundIndex + 1} total={4} mode="banner" />
      </div>

      <div class="score-strip" aria-label="Scoreboard">
        {#each game.players as player}
          <article class:active={game.currentTurnUid === player.uid || game.currentBidderUid === player.uid}>
            <img src={princessArt(player.princessId)} alt="" />
            <span><strong>{player.displayName}</strong><small>{zombiePrincess(player.princessId)?.name}</small></span>
            <b>{game.totalPoints[player.uid]} pts</b><em>☠ {game.skulls[player.uid]}</em><i>Bid {game.effectiveBids[player.uid] ?? '—'} · Tricks {game.countedTricks[player.uid] ?? 0}</i>
          </article>
        {/each}
      </div>

      <GameTableSurface playerCount={game.players.length} ariaLabel="Zombie Princess table">
        <div class="zombie-table-content">
        <div class="opponents">
          {#each game.players.filter((player) => player.uid !== currentUid) as player}
            <article class:active={game.currentTurnUid === player.uid || game.currentBidderUid === player.uid}>
              <strong>{player.displayName}</strong><span>{game.hands?.[player.uid]?.length ?? 0} cards</span><small>{zombiePrincess(player.princessId)?.power}</small>
            </article>
          {/each}
        </div>
        <div class="trick" aria-label="Current trick">
          {#each game.trick?.plays ?? [] as play}
            <figure><div class={`z-card ${play.card.suit}`}><GameCardFace artwork={{ kind: 'image', src: cardArt(play.card), alt: zombieCardLabel(play.card) }} rank={play.effectiveRank ?? play.card.rank} suit={zombieSuitName(play.card.suit)} aspect={2 / 3} display="trick" /></div><figcaption>{playerName(play.uid)}</figcaption></figure>
          {/each}
          {#if !game.trick?.plays.length}<p>Trick {game.completedTricks + 1}</p>{/if}
        </div>

        <aside class="phase-panel">
          {#if game.phase === 'pass'}
            {@const instruction = zombiePassInstruction(game.activeRoundId)}
            {#if game.passSubmissions[currentUid]}
              <p>Passing {instruction.count} {instruction.direction}. Waiting for the table.</p><button type="button" on:click={retractPass}>Change cards</button>
            {:else}
              <p>Choose {instruction.count} cards to pass {instruction.direction}.</p><button class="primary" type="button" disabled={selectedPassCards.length !== instruction.count} on:click={submitPass}>Pass cards</button>
            {/if}
          {:else if game.phase === 'set-aside'}
            <p>{game.setAsideCards[currentUid] ? 'Final-trick card reserved. Waiting for the table.' : 'Choose one card for the final trick.'}</p>
          {:else if game.phase === 'bid'}
            {#if game.currentBidderUid === currentUid}<label>How many tricks?<input type="number" min="0" max={localHand().length + 1} bind:value={bidValue} /></label><button class="primary" type="button" on:click={placeBid}>Bid {bidValue}</button>{:else}<p>Waiting for {playerName(game.currentBidderUid)} to bid.</p>{/if}
          {:else if game.phase === 'play'}
            <p>{game.currentTurnUid === currentUid ? 'Your turn. Play a highlighted card.' : `Waiting for ${playerName(game.currentTurnUid)}.`}</p>
            {#if localPlayer()?.princessId === 'ice-princess' && powerAvailable('ice-princess') && !game.trick?.plays.length}<button type="button" on:click={useIcePrincess}>Reduce bid to {Math.max(0, (game.effectiveBids[currentUid] ?? 0) - 1)}</button>{/if}
            {#if localPlayer()?.princessId === 'pea-princess' && powerAvailable('pea-princess') && game.currentTurnUid === currentUid}<button class:armed={armedPower === 'pea-princess'} type="button" on:click={() => armedPower = armedPower === 'pea-princess' ? '' : 'pea-princess'}>+5 on next card</button>{/if}
            {#if localPlayer()?.princessId === 'thumbelina' && powerAvailable('thumbelina') && game.currentTurnUid === currentUid}<button class:armed={armedPower === 'thumbelina'} type="button" on:click={() => armedPower = armedPower === 'thumbelina' ? '' : 'thumbelina'}>Ignore suit on next card</button>{/if}
            {#if localPlayer()?.princessId === 'dorothy' && powerAvailable('dorothy') && game.capturedTricks[currentUid]?.at(-1)?.index === game.completedTricks - 1}<button type="button" on:click={useDorothy}>Hide the trick just won</button>{/if}
            {#if localPlayer()?.princessId === 'scheherazade' && powerAvailable('scheherazade') && game.completedTricks === 3 && !game.trick?.plays.length}<label>New bid<input type="number" min="0" max="15" bind:value={changedBidValue} /></label><button type="button" on:click={changeBid}>Change bid</button>{/if}
            {#if localPlayer()?.princessId === 'red-riding-hood' && powerAvailable('red-riding-hood') && game.capturedTricks[currentUid]?.length}
              <details><summary>Swap with a won trick</summary><p>{redOffer ? `Offering ${redOffer}` : 'Choose an offer from your hand.'}</p>{#if redOffer}{#each game.capturedTricks[currentUid].flatMap((entry) => entry.plays).filter((play) => play.card.suit !== 'princes') as play}<button type="button" on:click={() => redSwap(play.card)}>Take {zombieCardLabel(play.card)}</button>{/each}{/if}</details>
            {/if}
          {:else if game.phase === 'frog'}
            {#if game.frogOwnerUid === currentUid}<p>Should the Frog trick count toward your bid?</p><button class="primary" type="button" on:click={() => frogDecision(true)}>Count it</button><button type="button" on:click={() => frogDecision(false)}>Ignore it</button>{:else}<p>{playerName(game.frogOwnerUid)} is deciding whether the Frog counts.</p>{/if}
          {:else if game.phase === 'score'}
            {#if game.scoreDecisionUids.includes(currentUid) && game.scoreDecisions[currentUid] === undefined}<p>You are {missingTricks()} short. Buy missing tricks for 3 skulls each?</p><div class="buy-options">{#each Array.from({ length: missingTricks() + 1 }, (_, index) => index) as amount}<button type="button" on:click={() => scoreDecision(amount)}>{amount === 0 ? 'Do not buy' : `Buy ${amount}`}</button>{/each}</div>{:else}<p>Waiting for scoring choices.</p>{/if}
          {:else if game.phase === 'round-complete' || game.phase === 'game-complete'}
            <p>{game.phase === 'game-complete' ? `${winnerNames()} ${game.winnerUids.length > 1 ? 'share the win' : 'wins'}.` : `Round ${game.roundIndex + 1} complete.`}</p>
          {/if}
          {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
        </aside>

        <section class="local-player">
          <header><img src={princessArt(localPlayer()?.princessId)} alt="" /><div><strong>{localPlayer()?.displayName}</strong><span>{zombiePrincess(localPlayer()?.princessId)?.power}</span></div></header>
          <div class="hand" aria-label="Your hand">
            {#each localHand() as card}
              {@const selected = selectedPassCards.includes(cardLabel(card)) || redOffer === cardLabel(card)}
              {@const playable = legal(card)}
              <button type="button" class={`z-card ${card.suit}`} class:selected class:playable disabled={handCardDisabled(card)} on:click={() => handleHandCard(card)}>
                <GameCardFace artwork={{ kind: 'image', src: cardArt(card), alt: zombieCardLabel(card) }} rank={card.rank} suit={zombieSuitName(card.suit)} badge={card.suit === 'pets' && card.rank === 6 ? 'Frog' : ''} aspect={2 / 3} />
              </button>
            {/each}
          </div>
        </section>
        </div>
      </GameTableSurface>

      {#if game.phase === 'round-complete' || game.phase === 'game-complete'}
        <section class="results">
          <h2>{game.phase === 'game-complete' ? 'Final score' : `Round ${game.roundIndex + 1}`}</h2>
          <div class="result-grid">{#each game.players as player}{@const score = game.roundScores[player.uid]}<article class:winner={game.winnerUids.includes(player.uid)}><strong>{player.displayName}</strong><span>Bid {score.bid} · {score.tricks} tricks{score.bought ? ` + ${score.bought} bought` : ''}</span><b>+{score.points} points</b><small>{score.skullsGained} skulls gained · {score.skullsSpent} spent · {score.skullsRemaining} remain</small><em>{game.totalPoints[player.uid]} total</em></article>{/each}</div>
          {#if game.phase === 'round-complete' && game.players[0]?.uid === currentUid}<button class="primary" type="button" on:click={dealRound}>Deal round {game.roundIndex + 2}</button>{/if}
          {#if game.phase === 'game-complete'}<a class="primary link-button" href={`${base}/`}>New room</a>{/if}
        </section>
      {/if}
    </section>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background: #140d1e; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(body) { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 77% 9%, rgba(149, 91, 184, .25), transparent 31rem), linear-gradient(145deg, #160e22 0%, #251638 48%, #101c24 100%); }
  main { display: flex; flex-direction: column; width: min(1180px, calc(100% - 48px)); min-height: 100vh; margin: 0 auto; }
  button, input { font: inherit; }
  button, .link-button { border: 1px solid rgba(255, 226, 163, .38); border-radius: 6px; padding: 9px 14px; color: #fff4d0; background: #604077; cursor: pointer; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid #ffc75f; outline-offset: 3px; }
  .primary { border-color: #ffc75f; color: #211329; background: #ffc75f; font-weight: 700; }
  .loading, .game-shell { width: 100%; }
  .loading { padding: 14vh 0; }.loading h1, .results h2 { margin: 0; color: #fff4d0; font-family: 'Cormorant Garamond', serif; }
  .shared-lobby { display: grid; flex: 1; place-items: center; padding: clamp(36px, 7vw, 80px) 0; }
  .game-shell { padding: 24px 0 80px; }.round-head { margin-bottom: 24px; }
  .score-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px; }.score-strip article { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 4px 9px; align-items: center; padding: 8px; border: 1px solid rgba(255, 226, 163, .16); border-radius: 12px; background: rgba(20, 13, 30, .78); }.score-strip article.active { border-color: #ffc75f; box-shadow: 0 0 18px rgba(255, 199, 95, .22); }.score-strip img { grid-row: span 2; width: 44px; height: 58px; object-fit: cover; border-radius: 6px; }.score-strip span { display: flex; flex-direction: column; }.score-strip small, .score-strip i { color: #a99dac; font-size: 10px; font-style: normal; }.score-strip b { color: #fff4d0; }.score-strip em { color: #ffc75f; font-style: normal; }.score-strip i { grid-column: 2 / -1; }
  .zombie-table-content { display: flex; flex-direction: column; min-height: 670px; padding: 18px; }
  .opponents { display: flex; justify-content: center; gap: 10px; }.opponents article { min-width: 150px; padding: 9px 12px; border: 1px solid rgba(255, 226, 163, .18); border-radius: 12px; background: #21152d; text-align: center; }.opponents article.active { border-color: #ffc75f; }.opponents strong, .opponents span, .opponents small { display: block; }.opponents span, .opponents small { color: #a99dac; font-size: 11px; }
  .trick { display: flex; justify-content: center; align-items: center; gap: 12px; min-height: 280px; padding: 28px 0; }.trick > p { color: #8d7c96; font-family: 'Cormorant Garamond', serif; font-size: 32px; }.trick figure { width: min(120px, 16vw); margin: 0; transform: rotate(var(--rotate, 0deg)); }.trick figcaption { margin-top: 5px; color: #d9cedd; font-size: 11px; text-align: center; }
  .z-card { position: relative; overflow: hidden; display: block; aspect-ratio: 2 / 3; border: 4px solid var(--suit); border-radius: 12px; padding: 3px; background: #150d1d; box-shadow: 0 12px 24px rgba(0, 0, 0, .3); }.z-card.fairies { --suit: #d29a43; }.z-card.pets { --suit: #7f9f4d; }.z-card.queens { --suit: #6c9eae; }.z-card.princes { --suit: #a36a9a; }
  .phase-panel { width: min(680px, calc(100% - 28px)); min-height: 72px; margin: 0 auto 18px; padding: 13px 16px; border: 1px solid rgba(184, 140, 223, .35); border-radius: 16px; background: rgba(20, 13, 30, .88); text-align: center; }.phase-panel p { margin: 0 0 9px; }.phase-panel label { display: inline-flex; align-items: center; gap: 9px; margin-right: 8px; }.phase-panel input { width: 66px; padding: 7px; border: 1px solid rgba(255, 226, 163, .3); border-radius: 8px; color: #fff4d0; background: #21152d; }.phase-panel button { margin: 3px; }.phase-panel button.armed { color: #211329; background: #ffc75f; }.phase-panel details { margin-top: 8px; }.buy-options { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .local-player { margin-top: auto; }.local-player > header { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 10px; }.local-player > header img { width: 42px; height: 55px; object-fit: cover; border: 1px solid #fff4d0; border-radius: 5px; }.local-player > header span, .local-player > header strong { display: block; }.local-player > header span { color: #a99dac; font-size: 11px; }.hand { display: flex; justify-content: center; align-items: flex-end; min-height: 188px; padding: 0 8px; }.hand button { width: clamp(72px, 8.5vw, 118px); margin-left: clamp(-32px, -2.3vw, -12px); transition: transform .15s ease, filter .15s ease; }.hand button:first-child { margin-left: 0; }.hand button.playable { transform: translateY(-15px); filter: drop-shadow(0 0 8px rgba(255, 199, 95, .7)); }.hand button.selected { transform: translateY(-26px); box-shadow: 0 0 0 3px #ffc75f, 0 13px 28px rgba(0,0,0,.4); }
  .results { margin-top: 24px; padding: 24px; border: 1px solid rgba(255, 226, 163, .25); border-radius: 22px; background: rgba(20, 13, 30, .82); }.results h2 { font-size: 48px; }.result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin: 18px 0; }.result-grid article { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid rgba(255, 226, 163, .15); border-radius: 12px; }.result-grid article.winner { border-color: #ffc75f; }.result-grid b { color: #ffc75f; }.result-grid small { color: #a99dac; }.result-grid em { color: #fff4d0; font-style: normal; font-weight: 700; }.link-button { display: inline-block; text-decoration: none; }
  .error { color: #f3a3a3; }
  @media (max-width: 800px) {
    main { width: min(100% - 28px, 520px); }
    .score-strip { display: flex; overflow-x: auto; }.score-strip article { min-width: 190px; }.zombie-table-content { min-height: 600px; padding: 10px; }.opponents { justify-content: flex-start; overflow-x: auto; }.opponents article { min-width: 125px; }.trick { min-height: 210px; gap: 5px; }.trick figure { width: min(95px, 23vw); }.hand { justify-content: flex-start; overflow-x: auto; padding: 24px 8px 12px; }.hand button { flex: 0 0 88px; margin-left: -25px; }.hand button:first-child { margin-left: 0; }
  }
</style>
