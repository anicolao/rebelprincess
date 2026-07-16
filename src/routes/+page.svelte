<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import suitAtlas from '../../assets/generated/suited-card-families.png';
  import roundAtlas from '../../assets/generated/round-rule-vignettes.png';
  import princessAtlas from '../../assets/generated/princess-portraits.png';
  import deluxePrincessAtlas from '../../assets/generated/princess-portraits-deluxe.png';
  import { ensureAnonymousIdentity, firebaseDatabase, probeFirebase } from '$lib/firebase';
  import {
    appendGameEvent,
    loadGame,
    normalizeGameId,
    subscribeToGame,
    type GameProjection
  } from '$lib/game-events';
  import { cardLabel, dealForPlayers, PRINCESSES, ROUND_RULES, ROUND_RULE_TEXT, SUITS, type Card } from '$lib/setup';
  import { passInstruction } from '$lib/passing';
  import { legalCardsWithPeaPower, mulanReplacements, PRINCESS_POWER_TEXT, snowWhiteCanZero, thumbelinaCanPlay } from '$lib/princess-powers';
  import { isMasqueradeHidden } from '$lib/round-rules';

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
  let selectedPassCards: Array<string | null> = [];
  let observedRoundIndex = -1;
  let snowWhiteArmed = false;
  let thumbelinaArmed = false;
  let openPrincessPower = '';
  let selectedPowerCards: Card[] = [];

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
      if (next.roundIndex !== observedRoundIndex) {
        selectedPassCards = [];
        observedRoundIndex = next.roundIndex;
      }
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
    if (!selectedPrincess || !game || !game.princessOptions[currentUid]?.includes(selectedPrincess)) return;
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
  function princessStyle(id?: string) {
    const index = PRINCESSES.findIndex(([key]) => key === id);
    if (index >= 10) return `--princess-x: ${(index - 10) * 100}%; --princess-y: 0%; --princess-size: 200% 100%; background-image: url(${deluxePrincessAtlas})`;
    return `--princess-x: ${(Math.max(0, index) % 5) * 25}%; --princess-y: ${Math.floor(Math.max(0, index) / 5) * 100}%; --princess-size: 500% 200%; background-image: url(${princessAtlas})`;
  }
  function localPlayer() { return game?.players.find((player) => player.uid === currentUid); }
  function playerName(uid?: string | null) { return game?.players.find((player) => player.uid === uid)?.displayName ?? 'the active player'; }
  function clockwiseOpponents() {
    if (!game) return [];
    const localIndex = game.players.findIndex((player) => player.uid === currentUid);
    return Array.from({ length: game.players.length - 1 }, (_, offset) => game!.players[(localIndex + offset + 1) % game!.players.length]);
  }
  function seatStyle(index: number, count: number) {
    const layouts: Record<number, Array<[number, number]>> = {
      2: [[28, 3], [72, 3]], 3: [[9, 34], [50, 3], [91, 34]],
      4: [[8, 35], [30, 3], [70, 3], [92, 35]], 5: [[8, 35], [27, 5], [50, 1], [73, 5], [92, 35]]
    };
    const [x, y] = layouts[count]?.[index] ?? [50, 3];
    return `--seat-x: ${x}%; --seat-y: ${y}%`;
  }
  function powerAvailable(id?: string) { return Boolean(id && game?.passComplete && !game.roundComplete && !game.exhaustedPrincessUids.includes(currentUid)); }
  function princessUsable(id?: string) {
    if (!id || !powerAvailable(id) || game?.awaitingRoundAction) return false;
    if (activeRoundId() === 'late-to-the-ball' && game?.completedTricks === 11 && (id === 'sleeping-beauty' || id === 'scheherazade')) return false;
    if (id === 'mulan') return game?.pendingMulanUid === currentUid;
    if (id === 'alice') return game?.lastCompletedTrick?.winnerUid === currentUid && !game.lastCompletedTrick.plays.some((play) => play.card.suit === 'pets' && play.card.rank === 8);
    if (id === 'snow-white') return game?.currentTurnUid === currentUid && game.hands?.[currentUid]?.some((card) => playable(card) && snowWhiteCanZero(card));
    if (id === 'thumbelina') return game?.currentTurnUid === currentUid && Boolean(game.trick?.plays.length) && game.hands?.[currentUid]?.some(thumbelinaCanPlay);
    return game?.trick?.plays.length === 0 && !game.pendingPower;
  }
  function roundName(id: string) { return ROUND_RULES.find(([key]) => key === id)?.[1] ?? id; }
  function roundRule(id: string) { return ROUND_RULE_TEXT[id] ?? 'Follow the rule printed on this round card.'; }
  function activeRoundId() { return game?.roundIds[game.roundIndex] ?? ''; }
  function mermaidSuits() {
    const hand = game?.hands?.[game?.trick?.leaderUid ?? ''] ?? [];
    return SUITS.filter((suit) => hand.some((card) => card.suit === suit) && (suit !== 'princes' || game?.princesBroken || hand.every((card) => card.suit === 'princes')));
  }
  function nextLeaderName() { return game?.players.find((player) => player.uid === game?.nextLeaderUid)?.displayName ?? ''; }
  function winnerNames() { return game?.winnerUids.map((uid) => game?.players.find((player) => player.uid === uid)?.displayName).filter(Boolean).join(' and ') ?? ''; }
  function suitIndex(card: Card) { return SUITS.indexOf(card.suit); }
  function roundStyle(id: string) {
    const index = Math.max(0, ROUND_RULES.findIndex(([key]) => key === id));
    return `--round-x: ${(index % 7) * 100 / 6}%; --round-y: ${Math.floor(index / 7) * 50}%; background-image: url(${roundAtlas})`;
  }
  function playOrigin(uid: string) {
    if (!game || uid === currentUid) return '--play-x: 0; --play-y: 34vh';
    const index = game.players.filter((player) => player.uid !== currentUid).findIndex((player) => player.uid === uid);
    return `--play-x: ${index % 2 === 0 ? '-24vw' : '24vw'}; --play-y: -32vh`;
  }
  function collectDestination(uid: string) {
    const origin = playOrigin(uid);
    return origin.replaceAll('--play-x', '--collect-x').replaceAll('--play-y', '--collect-y');
  }
  function lastCaptured(uid: string) {
    return game?.capturedTricks[uid]?.at(-1) ?? [];
  }

  function passRecipient(card?: Card): string {
    if (!game) return '';
    const instruction = passInstruction(activeRoundId());
    const index = game.players.findIndex((player) => player.uid === currentUid);
    const left = game.players[(index + 1) % game.players.length].displayName;
    const right = game.players[(index - 1 + game.players.length) % game.players.length].displayName;
    if (instruction.direction === 'left') return left;
    if (instruction.direction === 'right') return right;
    if (!card) return `${left} and ${right}`;
    const submittedIndex = game.passSubmissions[currentUid]?.findIndex((entry) => cardLabel(entry) === cardLabel(card)) ?? -1;
    return submittedIndex >= 0 && submittedIndex < Math.ceil(instruction.count / 2) ? left : right;
  }
  function waitingForPasses(): string {
    const count = game?.players.filter((player) => !game?.passSubmissions[player.uid]).length ?? 0;
    return `Waiting for ${count} other ${count === 1 ? 'player' : 'players'}.`;
  }

  function togglePassCard(card: Card) {
    if (!game || game.passComplete || game.passSubmissions[currentUid]) return;
    const label = cardLabel(card);
    const required = passInstruction(activeRoundId()).count;
    const existing = selectedPassCards.indexOf(label);
    if (existing >= 0) {
      selectedPassCards = selectedPassCards.map((entry, index) => index === existing ? null : entry);
      return;
    }
    const openSlot = selectedPassCards.findIndex((entry) => entry === null);
    if (openSlot >= 0) selectedPassCards = selectedPassCards.map((entry, index) => index === openSlot ? label : entry);
    else if (selectedPassCards.length < required) selectedPassCards = [...selectedPassCards, label];
  }

  async function submitPass() {
    if (!game?.hands || game.passComplete || game.passSubmissions[currentUid]) return;
    const instruction = passInstruction(activeRoundId());
    const hand = game.hands[currentUid];
    const cards = selectedPassCards.flatMap((label) => {
      const card = hand.find((held) => cardLabel(held) === label);
      return card ? [card] : [];
    });
    if (cards.length !== instruction.count) return;
    connection = 'checking';
    connectionLabel = 'Submitting cards…';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'pass/submitted', { cards });
  }

  async function reclaimPassCard(card: Card) {
    const committed = game?.passSubmissions[currentUid];
    if (!committed || game?.passComplete || !committed.some((entry) => cardLabel(entry) === cardLabel(card))) return;
    selectedPassCards = committed.map((entry) => cardLabel(entry) === cardLabel(card) ? null : cardLabel(entry));
    connection = 'checking';
    connectionLabel = 'Reclaiming cards…';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'pass/retracted', {});
  }

  function handleHandCard(card: Card) {
    if (game?.awaitingRoundAction) void submitRoundAction(card);
    else if (game?.passComplete) void playCard(card);
    else if (game?.passSubmissions[currentUid]) void reclaimPassCard(card);
    else togglePassCard(card);
  }

  function playable(card: Card): boolean {
    if (!game?.hands || !game.trick || game.pendingPower || game.awaitingRoundAction || game.currentTurnUid !== currentUid) return false;
    const forced = game.forcedCards[currentUid];
    if (thumbelinaArmed && localPlayer()?.princessId === 'thumbelina') return thumbelinaCanPlay(card);
    return forced ? cardLabel(forced) === cardLabel(card) : legalCardsWithPeaPower(game.hands[currentUid], game.trick, game.princesBroken, game.powerIdsThisTrick.includes('pea-princess')).some((candidate) => cardLabel(candidate) === cardLabel(card));
  }

  async function submitRoundAction(card: Card) {
    if (!game?.awaitingRoundAction || game.roundActionSubmissions[currentUid]) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, game.awaitingRoundAction === 'set-aside' ? 'round/card-set-aside' : 'round/pass-submitted', { card });
  }

  async function playCard(card: Card) {
    if (!game?.passComplete || !playable(card)) return;
    connection = 'checking';
    connectionLabel = `Playing ${cardLabel(card)}…`;
    if (snowWhiteArmed && localPlayer()?.princessId === 'snow-white' && snowWhiteCanZero(card)) {
      await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/activated', { powerId: 'snow-white', card });
      snowWhiteArmed = false;
    }
    if (thumbelinaArmed && localPlayer()?.princessId === 'thumbelina' && thumbelinaCanPlay(card)) {
      await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/activated', { powerId: 'thumbelina', card });
      thumbelinaArmed = false;
    }
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'card/played', { card });
  }

  async function activatePower(powerId: string, targetUid?: string, card?: Card, suit?: Card['suit'], cards?: Card[]) {
    const resolvingMulan = powerId === 'mulan' && game?.pendingMulanUid === currentUid;
    if ((!resolvingMulan && !powerAvailable(powerId)) || localPlayer()?.princessId !== powerId) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/activated', { powerId, ...(targetUid ? { targetUid } : {}), ...(card ? { card } : {}), ...(suit ? { suit } : {}), ...(cards ? { cards } : {}) });
  }

  async function usePrincessCard() {
    const powerId = localPlayer()?.princessId;
    if (!powerId || !princessUsable(powerId)) return;
    if (powerId === 'snow-white') {
      if (game?.currentTurnUid === currentUid && game.hands?.[currentUid]?.some((card) => playable(card) && snowWhiteCanZero(card))) snowWhiteArmed = !snowWhiteArmed;
      return;
    }
    if (powerId === 'thumbelina') {
      if (game?.currentTurnUid === currentUid && game.trick?.plays.length && game.hands?.[currentUid]?.some(thumbelinaCanPlay)) thumbelinaArmed = !thumbelinaArmed;
      return;
    }
    if (powerId === 'cinderella' || powerId === 'pea-princess' || powerId === 'rapunzel') {
      if (game?.trick?.plays.length === 0) await activatePower(powerId);
      return;
    }
    if (powerId === 'alice') { await activatePower(powerId); return; }
    if (['little-mermaid', 'ice-princess', 'scheherazade', 'sleeping-beauty'].includes(powerId) && game?.trick?.plays.length === 0) {
      openPrincessPower = openPrincessPower === powerId ? '' : powerId;
      selectedPowerCards = [];
      return;
    }
    if (powerId === 'pocahontas' && game?.trick?.plays.length === 0) openPrincessPower = openPrincessPower === powerId ? '' : powerId;
    if (powerId === 'mulan' && game?.pendingMulanUid === currentUid) openPrincessPower = openPrincessPower === powerId ? '' : powerId;
  }

  async function contributeSleepingBeauty(card: Card) {
    if (game?.pendingPower?.powerId !== 'sleeping-beauty' || game.pendingPower.cards.some((entry) => entry.uid === currentUid)) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/contributed', { powerId: 'sleeping-beauty', card });
  }

  function selectRedistribution(card: Card) {
    if (selectedPowerCards.some((entry) => cardLabel(entry) === cardLabel(card))) selectedPowerCards = selectedPowerCards.filter((entry) => cardLabel(entry) !== cardLabel(card));
    else if (selectedPowerCards.length < (game?.players.length ?? 0)) selectedPowerCards = [...selectedPowerCards, card];
  }

  async function declineMulan() {
    if (game?.pendingMulanUid !== currentUid) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/declined', { powerId: 'mulan' });
  }

  async function dealNextRound() {
    if (!game?.roundComplete || game.players[0]?.uid !== currentUid || !game.players.every((player) => player.ready) || game.roundIndex >= 4) return;
    const nextRound = game.roundIndex + 1;
    selectedPassCards = [];
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'game/dealt', {
      seed: `${game.seed ?? activeGameId}-round-${nextRound + 1}`,
      roundIds: game.roundIds,
      hands: dealForPlayers(game.players.map((player) => player.uid), `${game.seed ?? activeGameId}-round-${nextRound + 1}`)
    });
  }

  async function rematch() {
    if (!game?.gameComplete || game.players[0]?.uid !== currentUid) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'game/rematched', {});
    selectedPrincess = '';
    selectedRounds = [];
    selectedPassCards = [];
  }

  function newGame() {
    location.assign(new URL('./', location.href).pathname);
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
              {#each clockwiseOpponents() as player, index}
                <section class="opponent-seat" style={seatStyle(index, game.players.length - 1)} data-clockwise-seat={index + 1} aria-label={`${player.displayName}'s hand`}>
                  <strong>{player.displayName} · {game.hands[player.uid]?.length ?? 0} {#if game.trick?.leaderUid === player.uid}<span class="lead-marker">Leads</span>{/if}</strong>
                  <div class="seat-princess" class:exhausted={game.exhaustedPrincessUids.includes(player.uid)} aria-label={`${player.displayName}'s Princess: ${princessName(player.princessId)}`}>
                    <div class="princess-card" style={princessStyle(player.princessId)}></div>
                    <strong>{princessName(player.princessId)}</strong>
                    <span>{PRINCESS_POWER_TEXT[player.princessId ?? ''] ?? 'Power coming in a later increment.'}</span>
                  </div>
                  <div class="card-backs" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                  {#if game.passComplete}<details class="trick-counter">
                    <summary aria-label={`${player.displayName} tricks`}>{game.capturedTricks[player.uid]?.length ?? 0}</summary>
                    {#if lastCaptured(player.uid).length}
                      <div class="trick-review" aria-label={`${player.displayName} last trick`}>
                        {#each lastCaptured(player.uid) as play}
                          <span class="review-card" aria-label={cardLabel(play.card)} style={`--suit-index: ${suitIndex(play.card)}; background-image: url(${suitAtlas})`}><strong>{play.card.rank}</strong></span>
                        {/each}
                      </div>
                    {/if}
                  </details>{/if}
                </section>
              {/each}
            </div>

            <article class="round-center" aria-label="Current Round card">
              <h2>{roundName(activeRoundId())}</h2>
              <div class="round-art" style={roundStyle(activeRoundId())}></div>
              <p class="round-rule">{roundRule(activeRoundId())}</p>
              <div class="pass-icon" aria-label={`Pass ${passInstruction(activeRoundId()).count} ${passInstruction(activeRoundId()).direction}`}>
                {#if passInstruction(activeRoundId()).direction === 'left' || passInstruction(activeRoundId()).direction === 'split'}<span aria-hidden="true">&#8635;</span>{/if}
                <strong>{passInstruction(activeRoundId()).direction === 'split' ? passInstruction(activeRoundId()).count / 2 : passInstruction(activeRoundId()).count}</strong>
                {#if passInstruction(activeRoundId()).direction === 'right' || passInstruction(activeRoundId()).direction === 'split'}<span aria-hidden="true">&#8634;</span>{/if}
              </div>
              <p class="round-count">Round {game.roundIndex + 1} of 5</p>
              {#if game.powerIdsThisTrick.length}<p class="active-power" role="status">Princess power: {game.powerIdsThisTrick.map(princessName).join(', ')}</p>{/if}
            </article>

            {#if game.passComplete}
              {@const collecting = !game.trick?.plays.length && Boolean(game.lastCompletedTrick)}
              {@const visiblePlays = collecting ? game.lastCompletedTrick?.plays ?? [] : game.trick?.plays ?? []}
              <section class="live-trick" class:collecting aria-label={collecting ? 'Completed trick' : 'Current trick'}>
                {#each visiblePlays as play}
                  {@const masqueradeHidden = !collecting && play.uid !== currentUid && isMasqueradeHidden(activeRoundId(), game.trick!, play.uid, game.players.length)}
                  <article class="trick-play" style={collectDestination(game.lastCompletedTrick?.winnerUid ?? play.uid)} aria-label={`${game.players.find((player) => player.uid === play.uid)?.displayName} played ${masqueradeHidden ? 'a face-down card' : cardLabel(play.card)}`}>
                    <span>{game.players.find((player) => player.uid === play.uid)?.displayName}</span>
                    <div class="trick-card" class:face-down={masqueradeHidden} style={masqueradeHidden ? playOrigin(play.uid) : `${playOrigin(play.uid)}; --suit-index: ${suitIndex(play.card)}; background-image: url(${suitAtlas})`}>
                      {#if !masqueradeHidden}<strong>{play.card.rank}</strong><small>{play.card.suit}</small>
                        {#if play.effectiveRank === 0}<em>Counts as 0</em>{/if}
                      {/if}
                    </div>
                  </article>
                {/each}
              </section>
              {#each game.players as player}
                <span class="sr-only" aria-label={`${player.displayName} captured cards`}>{game.capturedCounts[player.uid] ?? 0}</span>
              {/each}
            {/if}

            <section class="local-seat" aria-label="Your seat">
              <div class="local-heading" class:local-leader={game.trick?.leaderUid === currentUid}><strong>{game.players.find((player) => player.uid === currentUid)?.displayName} · You {#if game.trick?.leaderUid === currentUid}<span class="lead-marker">You lead</span>{/if}</strong><span>{game.hands[currentUid]?.length ?? 0} cards</span></div>
              {#if game.passComplete && localPlayer()?.princessId}
                <div class="seat-princess local-princess" class:exhausted={game.exhaustedPrincessUids.includes(currentUid)} class:armed={snowWhiteArmed || thumbelinaArmed}>
                  <button type="button" class="princess-card" style={princessStyle(localPlayer()?.princessId)} aria-label={`Use ${princessName(localPlayer()?.princessId)} power`} aria-pressed={snowWhiteArmed || thumbelinaArmed || openPrincessPower === localPlayer()?.princessId} disabled={!princessUsable(localPlayer()?.princessId)} on:click={usePrincessCard}></button>
                  <strong>{princessName(localPlayer()?.princessId)}</strong>
                  <span>{PRINCESS_POWER_TEXT[localPlayer()?.princessId ?? ''] ?? 'Power coming in a later increment.'}</span>
                </div>
              {/if}
              {#if game.pendingMulanUid === currentUid && game.trick}
                {@const mulanPlay = game.trick.plays.find((play) => play.uid === currentUid)}
                {#if mulanPlay && openPrincessPower === 'mulan'}<div class="power-controls" role="group" aria-label="Mulan power">
                  <strong>Swap {cardLabel(mulanPlay.card)}?</strong>
                  {#each mulanReplacements(game.hands[currentUid] ?? [], mulanPlay) as replacement}
                    <button type="button" on:click={() => activatePower('mulan', undefined, replacement)}>Swap for {cardLabel(replacement)}</button>
                  {/each}
                  <button class="secondary" type="button" on:click={declineMulan}>Keep played card</button>
                </div>{/if}
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'pocahontas'}
                <div class="power-controls" role="group" aria-label="Pocahontas power"><strong>Choose the leader</strong>{#each game.players as player}<button type="button" on:click={() => activatePower('pocahontas', player.uid)}>{player.displayName} leads</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'little-mermaid'}
                <div class="power-controls" role="group" aria-label="Little Mermaid power"><strong>Choose the leader’s suit</strong>{#each mermaidSuits() as suit}<button type="button" on:click={() => activatePower('little-mermaid', undefined, undefined, suit)}>{suit}</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'ice-princess'}
                <div class="power-controls" role="group" aria-label="Ice Princess power"><strong>Choose a player</strong>{#each game.players as player}<button type="button" on:click={() => activatePower('ice-princess', player.uid)}>{player.displayName}</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'scheherazade'}
                <div class="power-controls" role="group" aria-label="Scheherazade power"><strong>Choose another hand</strong>{#each game.players.filter((player) => player.uid !== currentUid) as player}<button type="button" on:click={() => activatePower('scheherazade', player.uid)}>{player.displayName}</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'sleeping-beauty'}
                <div class="power-controls" role="group" aria-label="Sleeping Beauty power"><strong>Collect one card from every player</strong><button type="button" on:click={() => activatePower('sleeping-beauty')}>Begin collection</button></div>
              {/if}
              {#if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'ice-princess'}
                <div class="power-controls power-choice" role="group" aria-label="Ice Princess cards"><strong>Choose the frozen card</strong>{#each game.pendingPower.cards as entry}<button type="button" on:click={() => activatePower('ice-princess', undefined, entry.card)}>{cardLabel(entry.card)}</button>{/each}</div>
              {:else if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'scheherazade'}
                <div class="power-controls power-choice" role="group" aria-label="Scheherazade swap"><strong>Took {cardLabel(game.pendingPower.cards[0].card)}</strong>{#each game.hands[currentUid] ?? [] as card}<button type="button" on:click={() => activatePower('scheherazade', undefined, card)}>Swap {cardLabel(card)}</button>{/each}<button type="button" class="secondary" on:click={() => appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/declined', { powerId: 'scheherazade' })}>Return it</button></div>
              {:else if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'sleeping-beauty' && game.pendingPower.cards.length === game.players.length}
                <div class="power-controls power-choice" role="group" aria-label="Sleeping Beauty redistribution"><strong>Choose in order: keep, then {game.players.filter((player) => player.uid !== currentUid).map((player) => player.displayName).join(', ')}</strong>{#each game.pendingPower.cards as entry}<button type="button" class:chosen={selectedPowerCards.some((card) => cardLabel(card) === cardLabel(entry.card))} on:click={() => selectRedistribution(entry.card)}>{selectedPowerCards.findIndex((card) => cardLabel(card) === cardLabel(entry.card)) + 1 || ''} {cardLabel(entry.card)}</button>{/each}<button type="button" disabled={selectedPowerCards.length !== game.players.length} on:click={() => activatePower('sleeping-beauty', undefined, undefined, undefined, selectedPowerCards)}>Redistribute</button></div>
              {:else if game.pendingPower?.powerId === 'sleeping-beauty' && !game.pendingPower.cards.some((entry) => entry.uid === currentUid)}
                <p class="power-prompt">Sleeping Beauty asks you to contribute one card.</p>
              {/if}
              {#if game.passComplete}<details class="trick-counter local-counter">
                <summary aria-label={`${game.players.find((player) => player.uid === currentUid)?.displayName} tricks`}>{game.capturedTricks[currentUid]?.length ?? 0}</summary>
                {#if lastCaptured(currentUid).length}
                  <div class="trick-review" aria-label={`${game.players.find((player) => player.uid === currentUid)?.displayName} last trick`}>
                    {#each lastCaptured(currentUid) as play}
                      <span class="review-card" aria-label={cardLabel(play.card)} style={`--suit-index: ${suitIndex(play.card)}; background-image: url(${suitAtlas})`}><strong>{play.card.rank}</strong></span>
                    {/each}
                  </div>
                {/if}
              </details>{/if}
              <div class="hand" role="region" aria-label="Your hand">
                {#each game.hands[currentUid] ?? [] as card}
                  {@const committed = !game.passComplete && game.passSubmissions[currentUid]?.some((entry) => cardLabel(entry) === cardLabel(card))}
                  {@const roundActionAvailable = Boolean(game.awaitingRoundAction && !game.roundActionSubmissions[currentUid])}
                  <button type="button" class="playing-card" class:selected={selectedPassCards.includes(cardLabel(card))} class:committed class:playable={game.passComplete && playable(card)} class:contributable={roundActionAvailable || (game.pendingPower?.powerId === 'sleeping-beauty' && !game.pendingPower.cards.some((entry) => entry.uid === currentUid))} disabled={game.passComplete ? (!playable(card) && !roundActionAvailable && !(game.pendingPower?.powerId === 'sleeping-beauty' && !game.pendingPower.cards.some((entry) => entry.uid === currentUid))) : Boolean(game.passSubmissions[currentUid] && !committed)} aria-label={cardLabel(card)} on:click={() => game?.pendingPower?.powerId === 'sleeping-beauty' ? contributeSleepingBeauty(card) : handleHandCard(card)}>
                    <div class="card-art" style={`--suit-index: ${suitIndex(card)}; background-image: url(${suitAtlas})`}></div>
                    <strong>{card.rank}</strong><small>{card.suit}</small>
                    {#if committed}<em>To {passRecipient(card)}</em>{/if}
                  </button>
                {/each}
              </div>
              <div class="pass-controls">
                {#if game.roundComplete}
                  <p class="pass-complete" role="alert">Round {game.roundIndex + 1} complete · scoring revealed</p>
                {:else if game.passComplete}
                  {#if game.awaitingRoundAction === 'set-aside'}<p class="pass-waiting" role="alert">Late to the Ball · {game.roundActionSubmissions[currentUid] ? 'Card reserved for the final trick' : 'Choose one card to reserve for the final trick'}</p>
                  {:else if game.awaitingRoundAction === 'musical-pass'}<p class="pass-waiting" role="alert">Musical Chairs · {game.roundActionSubmissions[currentUid] ? 'Waiting for the other chairs' : 'Choose one card to pass right'}</p>
                  {:else if game.pendingMulanUid}<p class="pass-waiting" role="alert">{game.pendingMulanUid === currentUid ? 'Tap Mulan to swap her played card or keep it' : `Waiting for ${playerName(game.pendingMulanUid)} to resolve Mulan`}</p>
                  {:else if game.pendingPower}<p class="pass-waiting" role="alert">Waiting for {playerName(game.pendingPower.actorUid)} to resolve {princessName(game.pendingPower.powerId)}</p>
                  {:else}<p class="pass-complete" role="alert">Passing complete · {game.currentTurnUid === currentUid ? 'Your turn — play a highlighted card' : `Waiting for ${playerName(game.currentTurnUid)}`} · Trick {game.completedTricks + 1}</p>{/if}
                {:else if game.passSubmissions[currentUid]}
                  <p class="pass-waiting" role="alert">Passing {game.passSubmissions[currentUid].length} {passInstruction(activeRoundId()).direction} to {passRecipient()} · {waitingForPasses()} Select a raised card to take it back.</p>
                {:else}
                  {@const instruction = passInstruction(activeRoundId())}
                  <button class="pass-submit" type="button" disabled={selectedPassCards.filter(Boolean).length !== instruction.count} on:click={submitPass}>Pass {instruction.count} {instruction.direction} to {passRecipient()}</button>
                {/if}
              </div>
            </section>
            {#if game.roundComplete}
              <section class="round-results" aria-label={`Round ${game.roundIndex + 1} scoring`}>
                <h2>{game.gameComplete ? 'The ball is over' : 'Proposals received'}</h2>
                {#if game.gameComplete}
                  <p class="victory" role="status">{game.winnerUids.length > 1 ? 'Shared victory' : 'Winner'}: {winnerNames()}</p>
                {:else}
                  <p class="next-lead">Lowest total leads next: {nextLeaderName()}</p>
                {/if}
                <ul>
                  {#each game.players as player}
                    <li class:winner={game.winnerUids.includes(player.uid)}><strong>{player.displayName}</strong><span>{game.roundScores[player.uid].princes} Princes + {game.roundScores[player.uid].frog} Frog{#if game.roundScores[player.uid].roundRule} + {game.roundScores[player.uid].roundRule} Round rule{/if} = {game.roundScores[player.uid].total}</span><b>{game.totalScores[player.uid]} total · {game.zeroRounds[player.uid]} zero rounds</b></li>
                  {/each}
                </ul>
                {#if game.gameComplete}
                  <p class="princess-kept">Lowest score wins; tied scores favor the most zero-proposal rounds.</p>
                  <div class="result-actions">
                    {#if game.players[0]?.uid === currentUid}<button class="results-ready" type="button" on:click={rematch}>Rematch</button>{/if}
                    <button class="secondary" type="button" on:click={newGame}>New game</button>
                  </div>
                {:else}
                  <p class="princess-kept">Princesses stay with their players and refresh their powers.</p>
                  {#if game.players[0]?.uid === currentUid}
                    <button class="results-ready" type="button" on:click={dealNextRound}>Deal round {game.roundIndex + 2}</button>
                  {:else}
                    <p>Waiting for the host to deal round {game.roundIndex + 2}</p>
                  {/if}
                {/if}
              </section>
            {/if}
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
            <fieldset class="choice-grid" aria-label="Choose one of your two Princesses">
              <legend>Choose one of your two dealt Princesses</legend>
              {#each game?.princessOptions[currentUid] ?? [] as princessId}
                {@const princess = PRINCESSES.find(([id]) => id === princessId)}
                <button type="button" class:chosen={selectedPrincess === princessId} on:click={() => selectedPrincess = princessId}>{princess?.[1] ?? princessId}</button>
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
  .round-center { position: absolute; top: 45%; left: 50%; width: clamp(180px, 22vh, 230px); margin: 0; transform: translate(-50%, -50%); text-align: center; }
  .round-art { width: clamp(84px, 55%, 118px); aspect-ratio: .855; margin: 5px auto; border: 1px solid rgba(255, 226, 163, .5); border-radius: 7px; background-size: 700% 300%; background-position: var(--round-x) var(--round-y); box-shadow: 0 10px 25px rgba(0, 0, 0, .45); }
  .round-center p { margin: 0; color: #b88cdf; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .round-center h2 { margin: 0; font-size: clamp(16px, 2.3vh, 22px); line-height: 1; }
  .round-center .round-rule { margin: 5px auto 0; max-width: 190px; color: #eee4f0; font-size: clamp(9px, 1.25vh, 12px); font-weight: 400; line-height: 1.15; letter-spacing: 0; text-transform: none; }
  .pass-icon { display: flex; justify-content: center; align-items: center; gap: 3px; margin-top: 4px; color: #ffc75f; font-size: clamp(17px, 2.5vh, 24px); line-height: 1; }
  .pass-icon strong { font-family: 'Atkinson Hyperlegible', sans-serif; font-size: .72em; }
  .round-center .round-count { margin-top: 4px; }
  .opponent-seat { position: absolute; z-index: 2; top: var(--seat-y); left: var(--seat-x); min-width: 105px; color: #e9deeb; text-align: center; transform: translateX(-50%); }
  .opponent-seat > strong { display: block; margin-bottom: 4px; font-size: 12px; }
  .seat-princess { position: absolute; top: 18px; left: -52px; display: grid; justify-items: center; width: 50px; color: #e9deeb; font-size: 7px; line-height: 1.05; }
  .seat-princess .princess-card { width: 38px; aspect-ratio: 3 / 5; min-height: 0; padding: 0; border: 1px solid rgba(255, 226, 163, .65); border-radius: 4px; background-color: #150d1d; background-position: var(--princess-x) var(--princess-y); background-size: var(--princess-size); box-shadow: 0 5px 12px rgba(0, 0, 0, .45); transform-origin: bottom center; transition: filter .2s ease, transform .2s ease; }
  .seat-princess > strong { max-width: 58px; margin-top: 2px; color: #ffc75f; font-size: 8px; }
  .seat-princess > span { display: block; width: 64px; margin-top: 1px; color: #d9cedd; text-align: center; }
  .seat-princess.exhausted .princess-card { filter: grayscale(1) saturate(0); transform: rotate(-12deg); }
  .seat-princess.exhausted > strong, .seat-princess.exhausted > span { color: #776f7b; }
  .local-princess { top: auto; bottom: 4px; left: 4px; z-index: 7; width: 76px; }
  .local-princess .princess-card { width: clamp(48px, 7vh, 66px); cursor: pointer; }
  .local-princess > span { width: 78px; font-size: 8px; }
  .local-princess.armed .princess-card { border-color: #7de2a7; box-shadow: 0 0 0 2px #7de2a7, 0 5px 12px rgba(0, 0, 0, .45); }
  .local-princess .princess-card:disabled { cursor: default; opacity: 1; }
  .lead-marker { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 999px; color: #211329; background: #ffc75f; font-family: 'Atkinson Hyperlegible', sans-serif; font-size: 9px; text-transform: uppercase; }
  .card-backs { display: flex; justify-content: center; height: 46px; }
  .card-backs i { width: 30px; height: 44px; margin-left: -18px; border: 1px solid #b88cdf; border-radius: 3px; background: repeating-linear-gradient(135deg, #251638 0 4px, #604077 4px 6px); box-shadow: 0 3px 7px rgba(0, 0, 0, .35); }
  .card-backs i:first-child { margin-left: 0; }
  .trick-counter { position: absolute; z-index: 8; top: 18px; right: -5px; }
  .trick-counter summary { display: grid; place-items: center; width: 23px; height: 23px; border: 1px solid #ffc75f; border-radius: 50%; color: #211329; background: #ffc75f; box-shadow: 0 3px 9px rgba(0, 0, 0, .45); cursor: pointer; font-size: 11px; font-weight: 700; list-style: none; }
  .trick-counter summary::-webkit-details-marker { display: none; }
  .trick-review { position: absolute; z-index: 9; top: 27px; left: 50%; display: none; gap: 3px; padding: 5px; border: 1px solid rgba(255, 226, 163, .6); border-radius: 6px; background: rgba(20, 13, 30, .96); box-shadow: 0 8px 24px rgba(0, 0, 0, .6); transform: translateX(-50%); }
  .trick-counter[open] .trick-review, .trick-counter:hover .trick-review, .trick-counter:focus-within .trick-review { display: flex; }
  .review-card { position: relative; display: block; width: 32px; aspect-ratio: 1717 / 3664; flex: 0 0 auto; overflow: hidden; border: 1px solid rgba(255, 226, 163, .6); border-radius: 3px; background-color: #150d1d; background-size: 400% 100%; background-position: calc(var(--suit-index) * 100% / 3) center; }
  .review-card strong { position: absolute; top: 1px; left: 3px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 13px; text-shadow: 0 1px 2px #000; }
  .local-seat { position: absolute; z-index: 3; inset: auto 8px 8px; }
  .local-counter { top: 0; right: 8px; }
  .local-counter .trick-review { top: auto; right: 0; bottom: 27px; left: auto; transform: none; }
  .local-heading { display: flex; justify-content: center; gap: 12px; margin-bottom: 5px; color: #fff4d0; font-size: 12px; }
  .local-heading span { color: #b88cdf; }
  .local-heading.local-leader { width: max-content; margin-right: auto; margin-left: auto; padding: 4px 9px; border: 1px solid #ffc75f; border-radius: 999px; color: #ffc75f; box-shadow: 0 0 14px rgba(255, 199, 95, .3); }
  .local-heading.local-leader .lead-marker { color: #211329; }
  .power-controls { display: flex; justify-content: center; align-items: center; gap: 4px; margin-bottom: 2px; color: #fff4d0; font-size: 10px; }
  .power-controls button { min-height: 28px; padding: 0 8px; font-size: 10px; }
  .power-choice { position: fixed; z-index: 30; top: 56%; left: 50%; width: min(90vw, 720px); max-height: 26vh; flex-wrap: wrap; overflow-y: auto; padding: 8px; border: 1px solid rgba(255, 226, 163, .65); border-radius: 8px; background: rgba(20, 13, 30, .97); transform: translate(-50%, -50%); }
  .power-choice button.chosen { color: #211329; background: #ffc75f; }
  .power-prompt { margin: 0 0 2px; color: #ffc75f; font-size: 10px; font-weight: 700; text-align: center; }
  .playing-card.contributable { border-color: #7de2a7; box-shadow: 0 0 0 1px #7de2a7; }
  .hand { display: flex; justify-content: center; align-items: flex-end; min-height: clamp(78px, 15vh, 145px); padding-top: 8px; }
  .playing-card { position: relative; width: clamp(50px, 6.3vw, 78px); height: auto; min-height: 0; aspect-ratio: 1717 / 3664; padding: 0; overflow: hidden; flex: 0 0 auto; border: 1px solid rgba(255, 226, 163, .5); border-radius: 5px; background: #150d1d; transition: transform .15s ease; }
  .playing-card + .playing-card { margin-left: clamp(-27px, -1.8vw, -12px); }
  .playing-card:not(:disabled) { cursor: pointer; }
  .playing-card.selected, .playing-card.committed { border: 3px solid #ffc75f; transform: translateY(-9px); box-shadow: 0 7px 18px rgba(0, 0, 0, .45); }
  .playing-card.committed { border-color: #7de2a7; }
  .playing-card.playable { border-color: #ffc75f; box-shadow: 0 0 0 1px #ffc75f; }
  .playing-card:disabled { opacity: 1; color: inherit; }
  .playing-card strong { position: absolute; top: 4px; left: 7px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 25px; text-shadow: 0 1px 3px #000; }
  .playing-card small { position: absolute; inset: auto 4px 4px; color: #fff4d0; font-size: 9px; text-align: center; text-transform: capitalize; text-shadow: 0 1px 3px #000; }
  .playing-card em { position: absolute; z-index: 2; inset: auto 0 0; padding: 3px 1px 3px 4px; color: #102019; background: #7de2a7; font-size: 8px; font-style: normal; text-align: left; white-space: nowrap; }
  .card-art { position: absolute; inset: 0; opacity: .72; background-size: 400% 100%; background-position: calc(var(--suit-index) * 100% / 3) center; }
  .pass-controls { min-height: 37px; display: flex; justify-content: center; align-items: center; }
  .pass-submit { min-height: 32px; padding: 0 15px; font-size: 12px; }
  .pass-waiting, .pass-complete { margin: 0; color: #d9cedd; font-size: 11px; text-align: center; }
  .pass-complete { color: #7de2a7; font-weight: 700; }
  .live-trick { position: absolute; z-index: 4; top: 61%; left: 50%; display: flex; justify-content: center; align-items: flex-end; gap: 8px; width: min(90%, 440px); color: #fff4d0; font-size: 10px; pointer-events: none; transform: translateX(-50%); }
  .trick-play { display: grid; justify-items: center; gap: 2px; }
  .trick-card { position: relative; width: clamp(42px, 5vw, 62px); aspect-ratio: 1717 / 3664; overflow: hidden; border: 1px solid rgba(255, 226, 163, .7); border-radius: 4px; background-color: #150d1d; background-size: 400% 100%; background-position: calc(var(--suit-index) * 100% / 3) center; box-shadow: 0 8px 18px rgba(0, 0, 0, .5); animation: play-to-table .35s ease-out both; }
  .trick-card.face-down { background: repeating-linear-gradient(135deg, #251638 0 7px, #604077 7px 10px); }
  .trick-card strong { position: absolute; top: 2px; left: 5px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 20px; text-shadow: 0 1px 3px #000; }
  .trick-card small { position: absolute; inset: auto 3px 3px; color: #fff4d0; font-size: 7px; text-align: center; text-transform: capitalize; text-shadow: 0 1px 3px #000; }
  .trick-card em { position: absolute; inset: auto 0 14px; color: #211329; background: #ffc75f; font-size: 8px; font-style: normal; font-weight: 700; text-align: center; }
  .live-trick.collecting .trick-play { animation: collect-trick 3s ease-in-out forwards; }
  @keyframes play-to-table { from { opacity: .3; transform: translate(var(--play-x), var(--play-y)) scale(1.15); } to { opacity: 1; transform: translate(0, 0) scale(1); } }
  @keyframes collect-trick {
    0%, 62% { opacity: 1; transform: translate(0, 0) scale(1); }
    100% { opacity: 0; transform: translate(var(--collect-x), var(--collect-y)) scale(.65); }
  }
  .round-results { position: absolute; z-index: 20; inset: 8% 12%; display: flex; flex-direction: column; align-items: center; overflow: auto; padding: 14px; border: 1px solid rgba(255, 226, 163, .65); border-radius: 12px; color: #fff4d0; background: rgba(20, 13, 30, .97); box-shadow: 0 18px 60px rgba(0, 0, 0, .7); }
  .round-results > * { flex-shrink: 0; }
  .round-results h2 { margin: 0 0 8px; }
  .round-results ul { width: min(100%, 520px); margin: 0; padding: 0; list-style: none; }
  .round-results li { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255, 226, 163, .15); font-size: 12px; }
  .round-results li span { color: #d8c8dc; }
  .round-results li b { color: #ffc75f; }
  .round-results li.winner { margin: 2px -8px; padding: 7px 8px; border-radius: 8px; background: rgba(255, 199, 95, .14); }
  .victory { margin: 0 0 8px; color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: clamp(22px, 4vw, 36px); font-weight: 700; }
  .result-actions { display: flex; gap: 8px; }
  .result-actions .secondary { min-height: 34px; margin-top: 5px; padding: 0 16px; font-size: 12px; }
  .results-ready { min-height: 34px; margin-top: 5px; padding: 0 16px; font-size: 12px; }

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
    main.gameplay .playing-card { height: auto; min-height: 0; }
    main.gameplay .playing-card { width: 44px; }
    main.gameplay .playing-card + .playing-card { margin-left: -15px; }
    main.gameplay .local-princess { bottom: 118px; }
    main.gameplay .local-seat { bottom: 2px; }
    main.gameplay .round-center { top: 43%; }
    main.gameplay .round-results { inset: 8% 5%; }

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
