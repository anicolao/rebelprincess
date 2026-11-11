<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { goto, replaceState } from '$app/navigation';
  import GameLobby from '$lib/components/GameLobby.svelte';
  import GameMasthead from '$lib/components/GameMasthead.svelte';
  import GameResultsOverlay from '$lib/components/GameResultsOverlay.svelte';
  import GameRoomEntry from '$lib/components/GameRoomEntry.svelte';
  import GameTable from '$lib/components/GameTable.svelte';
  import SpriteCard from '$lib/components/SpriteCard.svelte';
  import { cardSpriteProps, princessSpriteProps, roundSpriteProps } from '$lib/asset-sprites';
  import { ensureAnonymousIdentity, firebaseDatabase, probeFirebase } from '$lib/firebase';
  import { gameAudio } from '$lib/game-audio';
  import {
    appendGameEvent,
    loadGame,
    normalizeGameId,
    subscribeToGame,
    type GameVariant,
    type GameProjection
  } from '$lib/game-events';
  import { cardLabel, dealForPlayers, PRINCESSES, roundPowersForGame, ROUND_RULES, ROUND_RULE_TEXT, SUITS, type Card } from '$lib/setup';
  import { passInstruction } from '$lib/passing';
  import { mulanReplacements, PRINCESS_POWER_TEXT, snowWhiteCanZero, thumbelinaCanPlay } from '$lib/princess-powers';
  import { isMasqueradeHidden, roundLegalCards } from '$lib/round-rules';
  import { choiceCommitment, crystalClearChoiceScope, princessChoiceScope } from '$lib/choice-commitment';
  import { actionOwnership } from '$lib/action-ownership';
  import { isBeforeTrickPower } from '$lib/bat-priority';
  import { LiveBotController, type LiveBotState } from '$lib/live-bot';
  import { isBotSeat, readBotControllerRecords, writeBotControllerRecords, type BotControllerRecord } from '$lib/bot-controller-registry';
  import { BOT_DIFFICULTIES, BOT_DIFFICULTY_LABELS, type BotDifficulty } from '$lib/bot-policies';
  import type { HandCard, LobbyPlayer, LobbyPrincess, LocalSeat, OpponentSeat, ReviewCard, SeatPrincess, TableRound, TrickPlay } from '$lib/game-ui';

  let connection: 'checking' | 'synced' | 'error' = 'checking';
  let connectionLabel = 'Checking Firebase…';
  let displayName = '';
  let inviteCode = '';
  let selectedVariant: GameVariant = 'rebel';
  let activeGameId = '';
  let game: GameProjection | null = null;
  let actionError = '';
  let unsubscribe = () => {};
  let currentUid = '';
  let selectedPrincess = '';
  let princessCommitPending = false;
  let dealPending = false;
  let selectedPassCards: Array<string | null> = [];
  let observedRoundIndex = -1;
  let observedGameNumber = -1;
  let observedSleepingBeautyPendingKey = '';
  let snowWhiteArmed = false;
  let thumbelinaArmed = false;
  let openPrincessPower = '';
  let selectedPowerCards: Card[] = [];
  let selectedRoundCards: string[] = [];
  let selectedHaggleOffer = '';
  let mixerOpen = false;
  let musicVolume = 70;
  let effectsVolume = 85;
  let musicMuted = false;
  let effectsMuted = false;
  let celebratedPrincessId = '';
  let celebrationKey = 0;
  let showPrincessBurst = false;
  let celebrationTimer: ReturnType<typeof setTimeout> | null = null;
  let botControllers: LiveBotController[] = [];
  let liveBots: LiveBotState[] = [];
  let addingBot = false;
  let botDifficulty: BotDifficulty = 'standard';
  let removingBotUid = '';
  let recoveringBots = false;
  let recoveredBotGameId = '';
  const submittedPrincessReveals = new Set<string>();
  const submittedSuitReveals = new Set<string>();

  const build = import.meta.env.VITE_GIT_HASH ?? 'local';
  const audioMixStorageKey = 'rebel-princess:audio-mix';

  onMount(() => {
    try {
      const savedMix = JSON.parse(localStorage.getItem(audioMixStorageKey) ?? '{}');
      if (Number.isFinite(savedMix.musicVolume)) musicVolume = Math.max(0, Math.min(100, savedMix.musicVolume));
      if (Number.isFinite(savedMix.effectsVolume)) effectsVolume = Math.max(0, Math.min(100, savedMix.effectsVolume));
      if (typeof savedMix.musicMuted === 'boolean') musicMuted = savedMix.musicMuted;
      if (typeof savedMix.effectsMuted === 'boolean') effectsMuted = savedMix.effectsMuted;
    } catch {
      // Ignore malformed preferences and retain the balanced default mix.
    }
    applyAudioMix(false);
    const beginAudio = () => { if (!musicMuted) void gameAudio.startMusic(); };
    window.addEventListener('pointerdown', beginAudio, { once: true });
    window.addEventListener('keydown', beginAudio, { once: true });
    void (async () => {
      try {
        const pageUrl = new URL(location.href);
        if (pageUrl.searchParams.get('variant') === 'zombie') selectedVariant = 'zombie';
        const e2eUid = pageUrl.searchParams.get('e2eUid') ?? undefined;
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
    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', beginAudio);
      window.removeEventListener('keydown', beginAudio);
      if (celebrationTimer) clearTimeout(celebrationTimer);
      for (const controller of botControllers) void controller.stop();
      gameAudio.stopMusic();
    };
  });

  function watchGame(gameId: string) {
    unsubscribe();
    if (activeGameId && activeGameId !== gameId) {
      for (const controller of botControllers) void controller.stop();
      botControllers = [];
      liveBots = [];
    }
    activeGameId = gameId;
    recoveredBotGameId = '';
    dealPending = false;
    observedRoundIndex = -1;
    observedGameNumber = -1;
    observedSleepingBeautyPendingKey = '';
    openPrincessPower = '';
    selectedPowerCards = [];
    const parameters = new URL(location.href).searchParams;
    parameters.set('game', gameId);
    parameters.delete('gameId');
    replaceState(`?${parameters.toString()}`, {});
    unsubscribe = subscribeToGame(firebaseDatabase(), gameId, (next) => {
      if (next.variant === 'zombie') {
        void goto(`${base}/zombie/?game=${encodeURIComponent(gameId)}`);
        return;
      }
      if (next.roundIndex !== observedRoundIndex || next.gameNumber !== observedGameNumber) {
        selectedPassCards = [];
        openPrincessPower = '';
        selectedPowerCards = [];
        princessCommitPending = false;
        observedRoundIndex = next.roundIndex;
        observedGameNumber = next.gameNumber;
      }
      const sleepingBeautyPendingKey = next.pendingPower?.powerId === 'sleeping-beauty'
        ? `${next.gameNumber}:${next.roundIndex}:${next.pendingPower.actorUid}`
        : '';
      if (sleepingBeautyPendingKey !== observedSleepingBeautyPendingKey) {
        openPrincessPower = '';
        selectedPowerCards = [];
        observedSleepingBeautyPendingKey = sleepingBeautyPendingKey;
      }
      const nextPrincessPower = next.powerIdsThisTrick.at(-1) ?? '';
      if (nextPrincessPower !== celebratedPrincessId) {
        celebratedPrincessId = nextPrincessPower;
        celebrationKey += 1;
        if (celebrationTimer) clearTimeout(celebrationTimer);
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        showPrincessBurst = Boolean(nextPrincessPower);
        if (nextPrincessPower) {
          void gameAudio.playPrincessChime();
          celebrationTimer = setTimeout(() => showPrincessBurst = false, reducedMotion ? 500 : 2400);
        }
      }
      game = next;
      if (next.hands) dealPending = false;
      connection = 'synced';
      connectionLabel = 'Game synchronized';
      void revealCommittedPrincess(next);
      void revealCommittedCrystalSuit(next);
      void recoverRlBots(next);
    }, () => {
      connection = 'error';
      connectionLabel = 'Synchronization failed';
    });
  }

  type StoredChoice = { choice: string; nonce: string };

  function sealedChoiceKey(kind: 'princess' | 'crystal-clear', projection: GameProjection, uid: string): string {
    const phase = kind === 'princess' ? projection.gameNumber : `${projection.gameNumber}:${projection.roundIndex}`;
    return `rebel-princess:sealed-choice:${kind}:${projection.gameId}:${phase}:${uid}`;
  }

  function readStoredChoice(key: string): StoredChoice | null {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null');
      return value && typeof value.choice === 'string' && typeof value.nonce === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  async function revealCommittedPrincess(projection: GameProjection) {
    const player = projection.players.find((candidate) => candidate.uid === currentUid);
    const commitment = projection.princessCommitments[currentUid];
    if (!player || player.ready || !commitment || projection.players.length < 3 || !projection.players.every((candidate) => projection.princessCommitments[candidate.uid])) return;
    const key = sealedChoiceKey('princess', projection, currentUid);
    if (submittedPrincessReveals.has(key)) return;
    const stored = readStoredChoice(key);
    if (!stored || choiceCommitment(princessChoiceScope(projection.gameId, projection.gameNumber, currentUid), stored.choice, stored.nonce) !== commitment) {
      actionError = 'Your sealed Princess choice is unavailable in this browser.';
      return;
    }
    submittedPrincessReveals.add(key);
    try {
      await appendGameEvent(firebaseDatabase(), projection.gameId, currentUid, 'player/configured', {
        princessId: stored.choice, nonce: stored.nonce, ready: true
      });
    } catch {
      submittedPrincessReveals.delete(key);
    }
  }

  async function revealCommittedCrystalSuit(projection: GameProjection) {
    if (projection.awaitingRoundAction !== 'reveal-suit' || projection.revealedSuits[currentUid]) return;
    const commitment = projection.suitCommitments[currentUid];
    if (!commitment || !projection.players.every((player) => projection.suitCommitments[player.uid])) return;
    const key = sealedChoiceKey('crystal-clear', projection, currentUid);
    if (submittedSuitReveals.has(key)) return;
    const stored = readStoredChoice(key);
    if (!stored || choiceCommitment(crystalClearChoiceScope(projection.gameId, projection.gameNumber, projection.roundIndex, currentUid), stored.choice, stored.nonce) !== commitment) {
      actionError = 'Your sealed Crystal Clear choice is unavailable in this browser.';
      return;
    }
    submittedSuitReveals.add(key);
    try {
      await appendGameEvent(firebaseDatabase(), projection.gameId, currentUid, 'round/suit-revealed', {
        suit: stored.choice as Card['suit'], nonce: stored.nonce
      });
    } catch {
      submittedSuitReveals.delete(key);
    }
  }

  function applyAudioMix(persist = true) {
    gameAudio.setMix({
      musicVolume: musicVolume / 100,
      effectsVolume: effectsVolume / 100,
      musicMuted,
      effectsMuted
    });
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(audioMixStorageKey, JSON.stringify({ musicVolume, effectsVolume, musicMuted, effectsMuted }));
    }
  }

  function updateAudioMix() {
    applyAudioMix();
  }

  function toggleMusicMute() {
    musicMuted = !musicMuted;
    applyAudioMix();
    if (!musicMuted) void gameAudio.startMusic();
  }

  function toggleEffectsMute() {
    effectsMuted = !effectsMuted;
    applyAudioMix();
  }

  function toggleAllAudio() {
    const unmuteAll = musicMuted && effectsMuted;
    musicMuted = !unmuteAll;
    effectsMuted = !unmuteAll;
    applyAudioMix();
    if (unmuteAll) void gameAudio.startMusic();
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
      let variant: GameVariant = selectedVariant;
      if (type === 'player/joined') {
        const existing = await loadGame(firebaseDatabase(), gameId);
        if (existing.players.length === 0) throw new Error('Game not found');
        if (existing.players.length >= 6 && !existing.players.some((player) => player.uid === user.uid)) throw new Error('Game is full');
        variant = existing.variant ?? 'rebel';
      }
      await appendGameEvent(firebaseDatabase(), gameId, user.uid, type, { displayName: name, ...(type === 'game/created' ? { variant } : {}) });
      if (variant === 'zombie') await goto(`${base}/zombie/?game=${encodeURIComponent(gameId)}`);
      else watchGame(gameId);
    } catch {
      connection = 'error';
      connectionLabel = 'Could not update the room';
      actionError = 'The room could not be updated. Please try again.';
    }
  }

  async function becomeReady() {
    if (princessCommitPending || !selectedPrincess || !game || game.princessCommitments[currentUid] || !game.princessOptions[currentUid]?.includes(selectedPrincess)) return;
    princessCommitPending = true;
    connection = 'checking';
    connectionLabel = 'Sealing your Princess…';
    const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const key = sealedChoiceKey('princess', game, currentUid);
    localStorage.setItem(key, JSON.stringify({ choice: selectedPrincess, nonce } satisfies StoredChoice));
    try {
      await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'player/princess-committed', {
        commitment: choiceCommitment(princessChoiceScope(game.gameId, game.gameNumber, currentUid), selectedPrincess, nonce)
      });
    } catch {
      princessCommitPending = false;
      connection = 'error';
      connectionLabel = 'Could not seal your Princess';
      actionError = 'Your Princess choice could not be sealed. Please try again.';
    }
  }

  function nextBotNumber() {
    const used = new Set((game?.players ?? []).filter(isBotSeat).map((player) => Number(player.displayName.match(/(\d+)$/)?.[1])).filter(Number.isFinite));
    let number = 1;
    while (used.has(number)) number += 1;
    return number;
  }

  function botDisplayName(difficulty: BotDifficulty, number: number) {
    return `${difficulty === 'learned' ? 'RL' : BOT_DIFFICULTY_LABELS[difficulty]} Bot ${number}`;
  }

  async function addBot() {
    if (addingBot || !game || game.hands || game.players[0]?.uid !== currentUid || game.players.length >= 6 || Object.keys(game.princessCommitments).length > 0) return;
    addingBot = true;
    actionError = '';
    const difficulty = botDifficulty;
    const number = nextBotNumber();
    const botName = botDisplayName(difficulty, number);
    const instanceId = `${game.gameId}-${number}-${crypto.randomUUID()}`;
    const emulatorUid = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? `rl-bot-${game.gameId}-${number}` : undefined;
    const controller = new LiveBotController({
      gameId: game.gameId,
      displayName: botName,
      difficulty,
      instanceId,
      ...(emulatorUid ? { emulatorUid } : {}),
      receiveState: (state) => {
        const index = liveBots.findIndex((bot) => bot.displayName === botName);
        liveBots = index >= 0
          ? liveBots.map((bot, candidate) => candidate === index ? state : bot)
          : [...liveBots, state];
      }
    });
    botControllers = [...botControllers, controller];
    liveBots = [...liveBots, { uid: '', displayName: botName, difficulty, status: 'starting', detail: `Starting ${difficulty} policy` }];
    try {
      await controller.start();
      const state = controller.getState();
      const records = readBotControllerRecords(localStorage, game.gameId, currentUid)
        .filter((record) => record.seatUid !== state.uid);
      writeBotControllerRecords(localStorage, game.gameId, currentUid, [...records, {
        seatUid: state.uid, displayName: botName, instanceId, difficulty, ...(emulatorUid ? { emulatorUid } : {})
      }]);
    } catch {
      actionError = `${botName} could not join the room.`;
    } finally {
      addingBot = false;
    }
  }

  async function removeBot(seatUid: string) {
    if (removingBotUid || !game || game.hands || game.players[0]?.uid !== currentUid || Object.keys(game.princessCommitments).length > 0) return;
    const seat = game.players.find((player) => player.uid === seatUid);
    if (!seat || !isBotSeat(seat)) return;
    removingBotUid = seatUid;
    actionError = '';
    try {
      await appendGameEvent(firebaseDatabase(), game.gameId, currentUid, 'bot/removed', { targetUid: seatUid });
      const controller = botControllers.find((candidate) => candidate.getState().uid === seatUid);
      if (controller) await controller.stop();
      botControllers = botControllers.filter((candidate) => candidate !== controller);
      liveBots = liveBots.filter((bot) => bot.uid !== seatUid && bot.displayName !== seat.displayName);
      writeBotControllerRecords(localStorage, game.gameId, currentUid,
        readBotControllerRecords(localStorage, game.gameId, currentUid).filter((record) => record.seatUid !== seatUid));
    } catch {
      actionError = `${seat.displayName} could not be removed.`;
    } finally {
      removingBotUid = '';
    }
  }

  async function recoverRlBots(projection: GameProjection) {
    if (recoveringBots || recoveredBotGameId === projection.gameId || projection.players[0]?.uid !== currentUid) return;
    recoveringBots = true;
    try {
      const stored = readBotControllerRecords(localStorage, projection.gameId, currentUid);
      const records: BotControllerRecord[] = projection.players.filter(isBotSeat).map((seat) => {
        const existing = stored.find((record) => record.seatUid === seat.uid && record.displayName === seat.displayName);
        if (existing) return existing;
        return {
          seatUid: seat.uid,
          displayName: seat.displayName,
          instanceId: `${projection.gameId}-recovered-${crypto.randomUUID()}`,
          difficulty: 'learned',
          ...(import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? { emulatorUid: seat.uid } : {})
        };
      });
      writeBotControllerRecords(localStorage, projection.gameId, currentUid, records);
      for (const record of records) {
        if (botControllers.some((controller) => controller.getState().uid === record.seatUid)) continue;
        const controller = new LiveBotController({
          gameId: projection.gameId,
          displayName: record.displayName,
          difficulty: record.difficulty,
          instanceId: record.instanceId,
          seatUid: record.seatUid,
          ...(record.emulatorUid ? { emulatorUid: record.emulatorUid } : {}),
          claimSeat: async (controllerUid) => {
            await appendGameEvent(firebaseDatabase(), projection.gameId, currentUid, 'bot/controller-claimed', {
              seatUid: record.seatUid,
              controllerUid
            });
          },
          receiveState: (state) => {
            const index = liveBots.findIndex((bot) => bot.uid === record.seatUid || bot.displayName === record.displayName);
            liveBots = index >= 0
              ? liveBots.map((bot, candidate) => candidate === index ? state : bot)
              : [...liveBots, state];
          }
        });
        botControllers = [...botControllers, controller];
        liveBots = [...liveBots, { uid: record.seatUid, displayName: record.displayName, difficulty: record.difficulty, status: 'starting', detail: `Recovering ${record.difficulty} policy` }];
        await controller.start();
      }
      recoveredBotGameId = projection.gameId;
    } catch {
      actionError = 'One or more RL bots could not recover after reload.';
    } finally {
      recoveringBots = false;
    }
  }

  const previewCards = [
    { suit: 'fairies', rank: 7 },
    { suit: 'queens', rank: 7 },
    { suit: 'princes', rank: 7 },
    { suit: 'pets', rank: 7 }
  ] as Card[];

  async function dealCards() {
    if (dealPending || !game || game.players.length < 3 || game.players.length > 6 || !game.players.every((player) => player.ready)) return;
    actionError = '';
    dealPending = true;
    connection = 'checking';
    connectionLabel = 'Shuffling and dealing…';
    const seed = new URL(location.href).searchParams.get('seed') ?? crypto.randomUUID();
    const requestedRounds = new URL(location.href).searchParams.get('e2eRounds')?.split(',') ?? [];
    const knownRoundIds = new Set<string>(ROUND_RULES.map(([id]) => id));
    const e2eRoundIds = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && requestedRounds.length === 5 && new Set(requestedRounds).size === 5 && requestedRounds.every((id) => knownRoundIds.has(id))
      ? requestedRounds
      : null;
    try {
      await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'game/dealt', {
        seed,
        roundIds: e2eRoundIds ?? roundPowersForGame(`${activeGameId}:${game.gameNumber}:${seed}`),
        hands: dealForPlayers(game.players.map((player) => player.uid), seed),
        batPriority: true
      });
    } catch {
      dealPending = false;
      connection = 'error';
      connectionLabel = 'Could not deal the cards';
      actionError = 'The cards could not be dealt. Please try again.';
    }
  }

  function princessName(id?: string) { return PRINCESSES.find(([key]) => key === id)?.[1] ?? 'Choosing…'; }

  function localPlayer() { return game?.players.find((player) => player.uid === currentUid); }
  function lobbyPlayers(): LobbyPlayer[] {
    return game?.players.map((player) => ({
      ...player,
      committed: Boolean(game?.princessCommitments[player.uid]),
      princessName: princessName(player.princessId),
      removable: game?.players[0]?.uid === currentUid && isBotSeat(player) && !Object.keys(game.princessCommitments).length
    })) ?? [];
  }
  function lobbyPrincesses(): LobbyPrincess[] {
    return (game?.princessOptions[currentUid] ?? []).map((id) => ({
      id,
      name: princessName(id),
      text: PRINCESS_POWER_TEXT[id] ?? 'Power coming in a later increment.',
      artwork: { kind: 'sprite' as const, sprite: princessSpriteProps(id) }
    }));
  }
  function playerName(uid?: string | null) { return game?.players.find((player) => player.uid === uid)?.displayName ?? 'the active player'; }
  function localCardBlockExplanation() {
    if (game?.beforeTrickWindow) return game.beforeTrickWindow.priorityUid === currentUid ? 'Choose whether to use your before-trick power or decline.' : `Waiting for ${playerName(game.beforeTrickWindow.priorityUid)} to decide on a before-trick power.`;
    if (!game?.hands || game.currentTurnUid !== currentUid || game.awaitingRoundAction || game.pendingPower || game.pendingMulanUid) return '';
    const forced = game.forcedCards[currentUid];
    if (forced) return `Ice Princess chose ${cardLabel(forced)}. Only that card can be played.`;
    const ledSuit = game.trick?.plays[0]?.card.suit;
    if (ledSuit && game.hands[currentUid].some((card) => card.suit === ledSuit)) return `Follow ${ledSuit}. Lifted gold cards are legal now.`;
    return `Lifted gold cards are legal under ${roundName(activeRoundId())} and the active Princess powers.`;
  }
  function clockwiseOpponents() {
    if (!game) return [];
    const localIndex = game.players.findIndex((player) => player.uid === currentUid);
    return Array.from({ length: game.players.length - 1 }, (_, offset) => game!.players[(localIndex + offset + 1) % game!.players.length]);
  }
  function powerAvailable(id?: string) { return Boolean(id && game?.passComplete && !game.roundComplete && !game.exhaustedPrincessUids.includes(currentUid)); }
  function canSignalBeforeTrick(id?: string) {
    return Boolean(id && isBeforeTrickPower(id) && game?.batPriorityEnabled && !game.roundComplete && !game.exhaustedPrincessUids.includes(currentUid) && game.batSignalTargetTrick !== null);
  }
  function hasRaisedHand() {
    const signal = game?.batSignals[currentUid];
    return Boolean(signal?.raised && signal.targetTrickIndex === game?.batSignalTargetTrick);
  }
  function hasBeforeTrickPriority(id?: string) {
    return Boolean(id && isBeforeTrickPower(id) && game?.batPriorityEnabled && game.beforeTrickWindow?.priorityUid === currentUid && !game.pendingPower);
  }
  function canOpenLeaderBeforeTrickWindow(id?: string) {
    return Boolean(id && isBeforeTrickPower(id) && game?.batPriorityEnabled && powerAvailable(id) && !game.beforeTrickWindow && !game.pendingPower && !game.awaitingRoundAction && game.trick?.plays.length === 0 && game.trick.leaderUid === currentUid && game.currentTurnUid === currentUid);
  }
  function princessUsable(id?: string) {
    if (!id) return false;
    if (activeRoundId() === 'late-to-the-ball' && game?.completedTricks === 11 && (id === 'sleeping-beauty' || id === 'scheherazade')) return false;
    if (game?.batPriorityEnabled && isBeforeTrickPower(id)) return canSignalBeforeTrick(id) || hasBeforeTrickPriority(id) || canOpenLeaderBeforeTrickWindow(id);
    if (!powerAvailable(id) || game?.awaitingRoundAction) return false;
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
  function waitingForPasses(game: GameProjection | null): string {
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
    if (game?.awaitingRoundAction === 'haggle' && game.haggleWinnerUid === currentUid) selectedHaggleOffer = cardLabel(card);
    else if (game?.awaitingRoundAction === 'split-hand') toggleRoundCard(card);
    else if (game?.awaitingRoundAction && game.awaitingRoundAction !== 'reveal-suit') void submitRoundAction(card);
    else if (game?.passComplete) void playCard(card);
    else if (game?.passSubmissions[currentUid]) void reclaimPassCard(card);
    else togglePassCard(card);
  }

  function playable(card: Card): boolean {
    if (!game?.hands || !game.trick || game.pendingPower || game.beforeTrickWindow || game.awaitingRoundAction || game.currentTurnUid !== currentUid) return false;
    const forced = game.forcedCards[currentUid];
    if (thumbelinaArmed && localPlayer()?.princessId === 'thumbelina') return thumbelinaCanPlay(card);
    return forced ? cardLabel(forced) === cardLabel(card) : roundLegalCards(game.hands[currentUid], game.trick, game.princesBroken, activeRoundId(), game.powerIdsThisTrick.includes('pea-princess')).some((candidate) => cardLabel(candidate) === cardLabel(card));
  }

  async function submitRoundAction(card: Card) {
    if (!game?.awaitingRoundAction || game.roundActionSubmissions[currentUid]) return;
    const type = game.awaitingRoundAction === 'set-aside' ? 'round/card-set-aside' : game.awaitingRoundAction === 'wedding-gift' ? 'round/gift-submitted' : 'round/pass-submitted';
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, type, { card });
  }

  async function commitCrystalSuit(suit: Card['suit']) {
    if (game?.awaitingRoundAction !== 'reveal-suit' || game.suitCommitments[currentUid] || !game.hands?.[currentUid]?.some((card) => card.suit === suit)) return;
    const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const key = sealedChoiceKey('crystal-clear', game, currentUid);
    localStorage.setItem(key, JSON.stringify({ choice: suit, nonce } satisfies StoredChoice));
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'round/suit-committed', {
      commitment: choiceCommitment(crystalClearChoiceScope(game.gameId, game.gameNumber, game.roundIndex, currentUid), suit, nonce)
    });
  }

  function toggleRoundCard(card: Card) {
    if (game?.awaitingRoundAction !== 'split-hand' || game.roundCardSubmissions[currentUid]) return;
    const label = cardLabel(card);
    selectedRoundCards = selectedRoundCards.includes(label) ? selectedRoundCards.filter((entry) => entry !== label) : selectedRoundCards.length < Math.floor((game.hands?.[currentUid]?.length ?? 0) / 2) ? [...selectedRoundCards, label] : selectedRoundCards;
  }

  async function submitAfterPartyHalf() {
    if (game?.awaitingRoundAction !== 'split-hand' || game.roundCardSubmissions[currentUid]) return;
    const cards = (game.hands?.[currentUid] ?? []).filter((card) => selectedRoundCards.includes(cardLabel(card)));
    if (cards.length * 2 !== (game.hands?.[currentUid]?.length ?? 0)) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'round/half-selected', { cards });
  }

  async function submitHaggle(taken: Card) {
    if (game?.awaitingRoundAction !== 'haggle' || game.haggleWinnerUid !== currentUid || !selectedHaggleOffer) return;
    const offered = game.hands?.[currentUid]?.find((card) => cardLabel(card) === selectedHaggleOffer); if (!offered) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'round/haggle-swapped', { cards: [offered, taken] }); selectedHaggleOffer = '';
  }

  async function declineHaggle() {
    if (game?.awaitingRoundAction !== 'haggle' || game.haggleWinnerUid !== currentUid) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'round/haggle-declined', {}); selectedHaggleOffer = '';
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
    const resolvingPendingPower = game?.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === powerId;
    if ((!resolvingMulan && !resolvingPendingPower && !princessUsable(powerId)) || localPlayer()?.princessId !== powerId) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/activated', { powerId, ...(game?.beforeTrickWindow ? { windowId: game.beforeTrickWindow.id } : {}), ...(targetUid ? { targetUid } : {}), ...(card ? { card } : {}), ...(suit ? { suit } : {}), ...(cards ? { cards } : {}) });
  }

  async function toggleBeforeTrickHand() {
    if (!game || game.batSignalTargetTrick === null || !canSignalBeforeTrick(localPlayer()?.princessId)) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, hasRaisedHand() ? 'power/hand-lowered' : 'power/hand-raised', { targetTrickIndex: game.batSignalTargetTrick });
  }

  async function declineBeforeTrickPriority() {
    if (!game?.beforeTrickWindow || game.beforeTrickWindow.priorityUid !== currentUid || game.pendingPower) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/priority-declined', { windowId: game.beforeTrickWindow.id });
  }

  async function startBeforeTrickPower(powerId: string) {
    if (!game || (!hasBeforeTrickPriority(powerId) && !canOpenLeaderBeforeTrickWindow(powerId))) return;
    openPrincessPower = powerId;
    selectedPowerCards = [];
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/activation-started', { powerId, ...(game.beforeTrickWindow ? { windowId: game.beforeTrickWindow.id } : {}) });
  }

  async function usePrincessCard() {
    const powerId = localPlayer()?.princessId;
    if (!powerId || !princessUsable(powerId)) return;
    if (game?.batPriorityEnabled && isBeforeTrickPower(powerId)) {
      if (canSignalBeforeTrick(powerId)) await toggleBeforeTrickHand();
      else if (hasBeforeTrickPriority(powerId) || canOpenLeaderBeforeTrickWindow(powerId)) {
        if (powerId === 'cinderella' || powerId === 'pea-princess' || powerId === 'rapunzel') await activatePower(powerId);
        else if (powerId === 'sleeping-beauty') { openPrincessPower = openPrincessPower === powerId ? '' : powerId; selectedPowerCards = []; }
        else await startBeforeTrickPower(powerId);
      }
      return;
    }
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

  async function beginSleepingBeauty() {
    if (!game || game.pendingPower || !princessUsable('sleeping-beauty')) return;
    openPrincessPower = '';
    selectedPowerCards = [];
    if (game.batPriorityEnabled) await startBeforeTrickPower('sleeping-beauty');
    else await activatePower('sleeping-beauty');
  }

  function sleepingBeautySelectionComplete() {
    if (game?.pendingPower?.powerId !== 'sleeping-beauty' || game.pendingPower.actorUid !== currentUid || game.pendingPower.cards.length !== game.players.length) return false;
    const contributed = new Set(game.pendingPower.cards.map((entry) => cardLabel(entry.card)));
    const selected = selectedPowerCards.map(cardLabel);
    return selected.length === game.players.length && new Set(selected).size === game.players.length && selected.every((label) => contributed.has(label));
  }

  function selectRedistribution(card: Card) {
    const contributed = new Set(game?.pendingPower?.powerId === 'sleeping-beauty' ? game.pendingPower.cards.map((entry) => cardLabel(entry.card)) : []);
    if (!contributed.has(cardLabel(card))) return;
    const current = selectedPowerCards.filter((entry) => contributed.has(cardLabel(entry)));
    if (current.some((entry) => cardLabel(entry) === cardLabel(card))) selectedPowerCards = current.filter((entry) => cardLabel(entry) !== cardLabel(card));
    else if (current.length < (game?.players.length ?? 0)) selectedPowerCards = [...current, card];
  }

  async function redistributeSleepingBeauty() {
    if (!sleepingBeautySelectionComplete()) return;
    await activatePower('sleeping-beauty', undefined, undefined, undefined, selectedPowerCards);
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
      hands: dealForPlayers(game.players.map((player) => player.uid), `${game.seed ?? activeGameId}-round-${nextRound + 1}`),
      batPriority: true
    });
  }

  async function rematch() {
    if (!game?.gameComplete || game.players[0]?.uid !== currentUid) return;
    await appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'game/rematched', {});
    selectedPrincess = '';
    selectedPassCards = [];
  }

  function reviewCard(card: Card): ReviewCard {
    return {
      id: cardLabel(card),
      label: cardLabel(card),
      artwork: { kind: 'sprite', sprite: cardSpriteProps(card) },
      rank: card.rank,
      suit: card.suit,
      muted: true
    };
  }

  function tablePrincess(uid: string, id?: string): SeatPrincess {
    return {
      id,
      name: princessName(id),
      power: PRINCESS_POWER_TEXT[id ?? ''] ?? 'Power coming in a later increment.',
      artwork: { kind: 'sprite', sprite: princessSpriteProps(id) },
      exhausted: Boolean(game?.exhaustedPrincessUids.includes(uid)),
      active: celebratedPrincessId === id,
      aspect: 3 / 5
    };
  }

  function opponentSeatsModel(): OpponentSeat[] {
    if (!game?.hands) return [];
    return clockwiseOpponents().map((player) => {
      const ownership = actionOwnership(game!, player.uid);
      const revealedSuit = game?.revealedSuits[player.uid];
      return {
        uid: player.uid,
        name: player.displayName,
        handCount: game?.hands?.[player.uid]?.length ?? 0,
        active: ownership.state === 'active',
        complete: ownership.state === 'complete',
        actionLabel: ownership.state === 'idle' ? undefined : ownership.label,
        leader: game?.trick?.leaderUid === player.uid,
        princess: tablePrincess(player.uid, player.princessId),
        revealedCards: revealedSuit ? game?.hands?.[player.uid]?.filter((card) => card.suit === revealedSuit).map(reviewCard) : undefined,
        revealedLabel: revealedSuit ? `${player.displayName}'s revealed ${revealedSuit} cards` : undefined,
        capturedCount: game?.capturedTricks[player.uid]?.length ?? 0,
        capturedCardCount: game?.capturedCounts[player.uid] ?? 0,
        lastCaptured: lastCaptured(player.uid).map((play) => reviewCard(play.card)),
        showCaptured: game?.passComplete
      };
    });
  }

  function tableRoundModel(): TableRound {
    const instruction = passInstruction(activeRoundId());
    return {
      name: roundName(activeRoundId()),
      rule: roundRule(activeRoundId()),
      artwork: { kind: 'sprite', sprite: roundSpriteProps(activeRoundId()) },
      current: (game?.roundIndex ?? 0) + 1,
      total: 5,
      passCount: instruction.count,
      passDirection: instruction.direction
    };
  }

  function collectingTrick() {
    return Boolean(game?.passComplete && !game.trick?.plays.length && game.lastCompletedTrick);
  }

  function tableTrickModel(): TrickPlay[] {
    if (!game?.passComplete) return [];
    const collecting = collectingTrick();
    const plays = collecting ? game.lastCompletedTrick?.plays ?? [] : game.trick?.plays ?? [];
    return plays.map((play) => {
      const hidden = !collecting && play.uid !== currentUid && isMasqueradeHidden(activeRoundId(), game!.trick!, play.uid, game!.players.length);
      return {
        id: `${play.uid}:${cardLabel(play.card)}`,
        label: cardLabel(play.card),
        playerName: playerName(play.uid),
        artwork: { kind: 'sprite', sprite: cardSpriteProps(play.card) },
        rank: play.card.rank,
        suit: play.card.suit,
        badge: play.effectiveRank === 0 ? 'Counts as 0' : '',
        faceDown: hidden,
        originStyle: playOrigin(play.uid),
        collectStyle: collectDestination(game?.lastCompletedTrick?.winnerUid ?? play.uid)
      };
    });
  }

  function localSeatModel(_snowWhiteArmed = snowWhiteArmed, _thumbelinaArmed = thumbelinaArmed, _openPrincessPower = openPrincessPower, _handRaised = hasRaisedHand()): LocalSeat | undefined {
    if (!game?.hands) return undefined;
    const player = localPlayer();
    if (!player) return undefined;
    const ownership = actionOwnership(game, currentUid);
    const showPrincess = game.passComplete || (game.batPriorityEnabled && isBeforeTrickPower(player.princessId));
    return {
      name: player.displayName,
      handCount: game.hands[currentUid]?.length ?? 0,
      active: ownership.state === 'active',
      complete: ownership.state === 'complete',
      actionLabel: ownership.state === 'idle' ? undefined : ownership.label,
      leader: game.trick?.leaderUid === currentUid,
      princess: showPrincess ? {
        ...tablePrincess(currentUid, player.princessId),
        armed: snowWhiteArmed || thumbelinaArmed,
        pressed: snowWhiteArmed || thumbelinaArmed || openPrincessPower === player.princessId || _handRaised,
        usable: princessUsable(player.princessId),
        status: _handRaised ? `Hand raised for trick ${(game.batSignalTargetTrick ?? 0) + 1}` : undefined
      } : undefined,
      capturedCount: game.capturedTricks[currentUid]?.length ?? 0,
      capturedCardCount: game.capturedCounts[currentUid] ?? 0,
      lastCaptured: lastCaptured(currentUid).map((play) => reviewCard(play.card)),
      showCaptured: game.passComplete
    };
  }

  function princessButtonLabel() {
    const id = localPlayer()?.princessId;
    return canSignalBeforeTrick(id) ? `${hasRaisedHand() ? 'Lower' : 'Raise'} hand for ${princessName(id)} on the next trick` : `Use ${princessName(id)} power`;
  }

  function handCardsModel(_snowWhiteArmed = snowWhiteArmed, _thumbelinaArmed = thumbelinaArmed): HandCard[] {
    if (!game?.hands) return [];
    return (game.hands[currentUid] ?? []).map((card) => {
      const committed = !game!.passComplete && game!.passSubmissions[currentUid]?.some((entry) => cardLabel(entry) === cardLabel(card));
      const roundActionAvailable = Boolean(game!.awaitingRoundAction && game!.awaitingRoundAction !== 'reveal-suit' && game!.awaitingRoundAction !== 'split-hand' && !game!.roundActionSubmissions[currentUid]);
      const splitAvailable = game!.awaitingRoundAction === 'split-hand' && !game!.roundCardSubmissions[currentUid];
      const haggleAvailable = game!.awaitingRoundAction === 'haggle' && game!.haggleWinnerUid === currentUid;
      const sleepingBeautyContribution = game!.pendingPower?.powerId === 'sleeping-beauty' && !game!.pendingPower.cards.some((entry) => entry.uid === currentUid);
      const turnBlocked = game!.passComplete && game!.currentTurnUid === currentUid && !game!.awaitingRoundAction && !game!.pendingPower && !game!.pendingMulanUid && !playable(card);
      return {
        id: cardLabel(card),
        label: cardLabel(card),
        artwork: { kind: 'sprite', sprite: cardSpriteProps(card) },
        rank: card.rank,
        suit: card.suit,
        badge: committed ? `To ${passRecipient(card)}` : '',
        badgeAlign: committed ? 'left' as const : 'center' as const,
        muted: true,
        selected: selectedPassCards.includes(cardLabel(card)) || selectedRoundCards.includes(cardLabel(card)) || selectedHaggleOffer === cardLabel(card),
        committed,
        playable: game!.passComplete && playable(card),
        turnBlocked,
        contributable: roundActionAvailable || splitAvailable || haggleAvailable || sleepingBeautyContribution,
        disabled: game!.passComplete ? (!playable(card) && !roundActionAvailable && !splitAvailable && !haggleAvailable && !sleepingBeautyContribution) : Boolean(game!.passSubmissions[currentUid] && !committed),
        describedBy: turnBlocked ? 'card-block-explanation' : undefined
      };
    });
  }

  function handleHandCardId(id: string) {
    const card = game?.hands?.[currentUid]?.find((candidate) => cardLabel(candidate) === id);
    if (!card) return;
    if (game?.pendingPower?.powerId === 'sleeping-beauty') void contributeSleepingBeauty(card);
    else handleHandCard(card);
  }

  function powerBurstModel(_celebratedPrincessId = celebratedPrincessId, _showPrincessBurst = showPrincessBurst): SeatPrincess | undefined {
    return _celebratedPrincessId && _showPrincessBurst ? tablePrincess('', _celebratedPrincessId) : undefined;
  }

  function newGame() {
    location.assign(new URL('./', location.href).pathname);
  }
</script>

<svelte:head>
  <title>Rebel Princess — Live card play</title>
</svelte:head>

<main class:gameplay={Boolean(game?.hands)} data-e2e-layout>
  <GameMasthead homeHref={`${base}/`} brand="Rebel Princess" assetsHref={`${base}/assets/`} showAssets={!game?.hands} {connection} {connectionLabel} compact={Boolean(game?.hands)}>
    <svelte:fragment slot="tools">
      <div class="audio-controls">
        <button
          class="audio-toggle"
          type="button"
          aria-label={mixerOpen ? 'Close audio mixer' : 'Open audio mixer'}
          aria-expanded={mixerOpen}
          aria-controls="audio-mixer"
          on:click={() => mixerOpen = !mixerOpen}
        >
          {#if !(musicMuted && effectsMuted)}
            <svg class="audio-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 2.25v8.45a2.45 2.45 0 1 1-1.25-2.14V4.25l7-1.5v6.7a2.45 2.45 0 1 1-1.25-2.14V1.98L6 2.95z" />
            </svg>
          {/if}
          <span>{musicMuted && effectsMuted ? 'Sound off' : 'Sound on'}</span>
        </button>
        {#if mixerOpen}
          <section id="audio-mixer" class="audio-mixer" aria-label="Audio mixer">
            <div class="mixer-heading">
              <strong>Audio mixer</strong>
              <button class="mute-all" type="button" aria-pressed={musicMuted && effectsMuted} on:click={toggleAllAudio}>
                {musicMuted && effectsMuted ? 'Unmute both' : 'Mute both'}
              </button>
            </div>
            <div class="mixer-channel">
              <label for="music-volume">Music <output for="music-volume">{musicVolume}%</output></label>
              <input id="music-volume" type="range" min="0" max="100" step="1" bind:value={musicVolume} on:input={updateAudioMix} />
              <button type="button" aria-label={musicMuted ? 'Unmute music' : 'Mute music'} aria-pressed={musicMuted} on:click={toggleMusicMute}>{musicMuted ? 'Muted' : 'On'}</button>
            </div>
            <div class="mixer-channel">
              <label for="effects-volume">Effects <output for="effects-volume">{effectsVolume}%</output></label>
              <input id="effects-volume" type="range" min="0" max="100" step="1" bind:value={effectsVolume} on:input={updateAudioMix} />
              <button type="button" aria-label={effectsMuted ? 'Unmute effects' : 'Mute effects'} aria-pressed={effectsMuted} on:click={toggleEffectsMute}>{effectsMuted ? 'Muted' : 'On'}</button>
            </div>
          </section>
        {/if}
      </div>
    </svelte:fragment>
  </GameMasthead>

  <section class="hero" class:dealt={Boolean(game?.hands)} aria-labelledby="hero-title">
    <div class="copy">
      <p class="eyebrow">Five nights. Four suits. Zero unwanted proposals.</p>
      <h1 id="hero-title">The ball is almost ready.</h1>
      <p class="lede">
        A live trick-taking game for three to six fiercely independent princesses.
        Create a room, invite the court, and keep those princes at arm's length.
      </p>
      {#if activeGameId && game?.hands}
        <GameTable
          playerCount={game.players.length}
          opponents={opponentSeatsModel()}
          round={tableRoundModel()}
          trick={tableTrickModel()}
          localSeat={localSeatModel(snowWhiteArmed, thumbelinaArmed, openPrincessPower, hasRaisedHand())}
          handCards={handCardsModel(snowWhiteArmed, thumbelinaArmed)}
          onHandCard={handleHandCardId}
          onPrincess={usePrincessCard}
          princessLabel={princessButtonLabel()}
          collecting={collectingTrick()}
          doubleTrick={activeRoundId() === 'prince-rings-twice'}
          powerFlash={showPrincessBurst}
          powerBurst={powerBurstModel(celebratedPrincessId, showPrincessBurst)}
          powerBurstKey={celebrationKey}
          ariaLabel="Rebel Princess table"
        >
          <svelte:fragment slot="round-status">
            {#if game.blindTransferComplete}<p class="active-power" role="status">Blind Man’s Bluff · second hands passed right</p>{/if}
            {#if activeRoundId() === 'upside-down' && game.trick?.reversed}<p class="active-power" role="status">Upside Down · low cards currently win</p>{/if}
            {#if game.powerIdsThisTrick.length}<p class="active-power" role="status">Princess power: {game.powerIdsThisTrick.map(princessName).join(', ')}</p>{/if}
          </svelte:fragment>
          <svelte:fragment slot="local-controls">
              {#if game.beforeTrickWindow?.priorityUid === currentUid && !game.pendingPower}
                <div class="power-controls" role="group" aria-label="Before-trick decision"><strong>You have priority</strong><button type="button" class="secondary" on:click={declineBeforeTrickPriority}>Decline this time</button></div>
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
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && (openPrincessPower === 'pocahontas' || (game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'pocahontas'))}
                <div class="power-controls" role="group" aria-label="Pocahontas power"><strong>Choose the leader</strong>{#each game.players as player}<button type="button" on:click={() => activatePower('pocahontas', player.uid)}>{player.displayName} leads</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && (openPrincessPower === 'little-mermaid' || (game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'little-mermaid'))}
                <div class="power-controls" role="group" aria-label="Little Mermaid power"><strong>Choose the leader’s suit</strong>{#each mermaidSuits() as suit}<button type="button" on:click={() => activatePower('little-mermaid', undefined, undefined, suit)}>{suit}</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && (openPrincessPower === 'ice-princess' || (game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'ice-princess' && !game.pendingPower.targetUid))}
                <div class="power-controls" role="group" aria-label="Ice Princess power"><strong>Choose a player</strong>{#each game.players as player}<button type="button" on:click={() => activatePower('ice-princess', player.uid)}>{player.displayName}</button>{/each}</div>
              {:else if powerAvailable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && (openPrincessPower === 'scheherazade' || (game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'scheherazade' && !game.pendingPower.targetUid))}
                <div class="power-controls" role="group" aria-label="Scheherazade power"><strong>Choose another hand</strong>{#each game.players.filter((player) => player.uid !== currentUid) as player}<button type="button" on:click={() => activatePower('scheherazade', player.uid)}>{player.displayName}</button>{/each}</div>
              {:else if princessUsable(localPlayer()?.princessId) && game.trick?.plays.length === 0 && openPrincessPower === 'sleeping-beauty'}
                <div class="power-controls" role="group" aria-label="Sleeping Beauty power"><strong>Collect one card from every player</strong><button type="button" on:click={beginSleepingBeauty}>Begin collection</button></div>
              {/if}
              {#if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'ice-princess' && game.pendingPower.targetUid}
                <div class="power-controls power-choice" role="group" aria-label="Ice Princess cards"><strong>Choose the frozen card</strong>{#each game.pendingPower.cards as entry}<button type="button" on:click={() => activatePower('ice-princess', undefined, entry.card)}>{cardLabel(entry.card)}</button>{/each}</div>
              {:else if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'scheherazade' && game.pendingPower.targetUid}
                <div class="power-controls power-choice" role="group" aria-label="Scheherazade swap"><strong>Took {cardLabel(game.pendingPower.cards[0].card)}</strong>{#each game.hands[currentUid] ?? [] as card}<button type="button" on:click={() => activatePower('scheherazade', undefined, card)}>Swap {cardLabel(card)}</button>{/each}<button type="button" class="secondary" on:click={() => appendGameEvent(firebaseDatabase(), activeGameId, currentUid, 'power/declined', { powerId: 'scheherazade' })}>Return it</button></div>
              {:else if game.pendingPower?.actorUid === currentUid && game.pendingPower.powerId === 'sleeping-beauty' && game.pendingPower.cards.length === game.players.length}
                <div class="power-controls power-choice" role="group" aria-label="Sleeping Beauty redistribution"><strong>Choose in order: keep, then {game.players.filter((player) => player.uid !== currentUid).map((player) => player.displayName).join(', ')}</strong>{#each game.pendingPower.cards as entry}<button type="button" class:chosen={selectedPowerCards.some((card) => cardLabel(card) === cardLabel(entry.card))} on:click={() => selectRedistribution(entry.card)}>{selectedPowerCards.findIndex((card) => cardLabel(card) === cardLabel(entry.card)) + 1 || ''} {cardLabel(entry.card)}</button>{/each}<button type="button" disabled={!sleepingBeautySelectionComplete()} on:click={redistributeSleepingBeauty}>Redistribute</button></div>
              {:else if game.pendingPower?.powerId === 'sleeping-beauty' && !game.pendingPower.cards.some((entry) => entry.uid === currentUid)}
                <p class="power-prompt">Sleeping Beauty asks you to contribute one card.</p>
              {/if}
          </svelte:fragment>
          <svelte:fragment slot="local-status">
              {#if localCardBlockExplanation()}<p id="card-block-explanation" class="card-block-explanation">{localCardBlockExplanation()}</p>{/if}
              <div class="pass-controls">
                {#if game.roundComplete}
                  <p class="pass-complete" role="alert">Round {game.roundIndex + 1} complete · scoring revealed</p>
                {:else if game.passComplete}
                  {#if game.awaitingRoundAction === 'set-aside'}<p class="pass-waiting" role="alert">Late to the Ball · {game.roundActionSubmissions[currentUid] ? 'Card reserved for the final trick' : 'Choose one card to reserve for the final trick'}</p>
                  {:else if game.awaitingRoundAction === 'musical-pass'}<p class="pass-waiting" role="alert">Musical Chairs · {game.roundActionSubmissions[currentUid] ? 'Waiting for the other chairs' : 'Choose one card to pass right'}</p>
                  {:else if game.awaitingRoundAction === 'wedding-gift'}<p class="pass-waiting" role="alert">Wedding Gift · {game.roundActionSubmissions[currentUid] ? 'Gift wrapped · waiting for everyone' : 'Choose one face-down card for the gift pile'}</p>
                  {:else if game.awaitingRoundAction === 'reveal-suit'}
                    <div class="power-controls" role="group" aria-label="Crystal Clear suit choice"><strong>{game.suitCommitments[currentUid] ? (game.players.every((player) => game?.suitCommitments[player.uid]) ? 'All suits locked · revealing together' : 'Suit locked face down · waiting for everyone') : 'Choose one suit to lock face down'}</strong>{#if !game.suitCommitments[currentUid]}{#each SUITS.filter((suit) => game?.hands?.[currentUid]?.some((card) => card.suit === suit)) as suit}<button type="button" on:click={() => commitCrystalSuit(suit)}>{suit}</button>{/each}{/if}</div>
                  {:else if game.awaitingRoundAction === 'split-hand'}
                    <div class="power-controls" role="group" aria-label="After Party first hand"><strong>{game.roundCardSubmissions[currentUid] ? 'First hand chosen · waiting for everyone' : `Choose 6 cards for your first hand (${selectedRoundCards.length}/6)`}</strong>{#if !game.roundCardSubmissions[currentUid]}<button type="button" disabled={selectedRoundCards.length !== 6} on:click={submitAfterPartyHalf}>Set first hand</button>{/if}</div>
                  {:else if game.awaitingRoundAction === 'haggle'}
                    {#if game.haggleWinnerUid === currentUid}<div class="power-controls" role="group" aria-label="Haggle with the Hag"><strong>{selectedHaggleOffer ? `Offer ${selectedHaggleOffer}; choose a captured card` : 'Choose one card from your hand to offer'}</strong>{#if selectedHaggleOffer}{#each game.lastCompletedTrick?.plays.filter((play) => play.uid !== currentUid) ?? [] as play}<button type="button" on:click={() => submitHaggle(play.card)}>Take {cardLabel(play.card)}</button>{/each}{/if}<button type="button" class="secondary" on:click={declineHaggle}>Keep the trick unchanged</button></div>{:else}<p class="pass-waiting" role="alert">Waiting for {playerName(game.haggleWinnerUid)} to haggle</p>{/if}
                  {:else if game.pendingMulanUid}<p class="pass-waiting" role="alert">{game.pendingMulanUid === currentUid ? 'Tap Mulan to swap her played card or keep it' : `Waiting for ${playerName(game.pendingMulanUid)} to resolve Mulan`}</p>
                  {:else if game.pendingPower}<p class="pass-waiting" role="alert">Waiting for {playerName(game.pendingPower.actorUid)} to resolve {princessName(game.pendingPower.powerId)}</p>
                  {:else if game.beforeTrickWindow}<p class="pass-waiting" role="alert">{game.beforeTrickWindow.priorityUid === currentUid ? `Your before-trick decision — use ${princessName(localPlayer()?.princessId)} or decline` : `Waiting for ${playerName(game.beforeTrickWindow.priorityUid)}'s before-trick decision`}</p>
                  {:else}<p class="pass-complete" role="alert">Passing complete · {game.currentTurnUid === currentUid ? 'Your turn — play a highlighted card' : `Waiting for ${playerName(game.currentTurnUid)}`} · Trick {game.completedTricks + 1}</p>{/if}
                {:else if game.passSubmissions[currentUid]}
                  <p class="pass-waiting" role="alert">Passing {game.passSubmissions[currentUid].length} {passInstruction(activeRoundId()).direction} to {passRecipient()} · {waitingForPasses(game)} Select a raised card to take it back.</p>
                {:else}
                  {@const instruction = passInstruction(activeRoundId())}
                  <button class="pass-submit" type="button" disabled={selectedPassCards.filter(Boolean).length !== instruction.count} on:click={submitPass}>Pass {instruction.count} {instruction.direction} to {passRecipient()}</button>
                {/if}
              </div>
          </svelte:fragment>
          <svelte:fragment slot="overlay">
            {#if game.roundComplete}
              <GameResultsOverlay title={game.gameComplete ? 'The ball is over' : 'Proposals received'} ariaLabel={`Round ${game.roundIndex + 1} scoring`}>
                {#if game.gameComplete}
                  <p class="victory" role="status">{game.winnerUids.length > 1 ? 'Shared victory' : 'Winner'}: {winnerNames()}</p>
                {:else}
                  <p class="next-lead">Lowest total leads next: {nextLeaderName()}</p>
                {/if}
                <div class="score-card-wrap">
                  <table class="score-card" aria-label="Five-round score card">
                    <caption>Score card</caption>
                    <thead>
                      <tr>
                        <th scope="col">Princess</th>
                        {#each Array.from({ length: 5 }) as _, scoreIndex}
                          <th scope="col"><span><i>Round </i>{scoreIndex + 1}</span><small>{game.roundIds[scoreIndex] ? roundName(game.roundIds[scoreIndex]) : 'To be drawn'}</small></th>
                        {/each}
                        <th scope="col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each game.players as player}
                        <tr class:winner={game.winnerUids.includes(player.uid)}>
                          <th scope="row">{player.displayName}</th>
                          {#each Array.from({ length: 5 }) as _, scoreIndex}
                            {@const score = game.roundScoreHistory[scoreIndex]?.[player.uid]}
                            <td class="round-score" class:filled={Boolean(score)} class:pending={!score} aria-label={`${player.displayName}, round ${scoreIndex + 1}: ${score ? `${score.total} proposals` : 'not played'}`}>{score?.total ?? '—'}</td>
                          {/each}
                          <td class="score-total">{game.totalScores[player.uid]}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
                <ul class="round-result-list">
                  {#each game.players as player}
                    <li class:winner={game.winnerUids.includes(player.uid)}><strong>{player.displayName}</strong><span>{game.roundScores[player.uid].princes} Princes + {game.roundScores[player.uid].frog} Frog{#if game.roundScores[player.uid].roundRule} + {game.roundScores[player.uid].roundRule} Round rule{/if} = {game.roundScores[player.uid].total}</span>{#if game.rebelUids.includes(player.uid)}<em role="status">Rebel of the Ball · −10 proposals</em>{/if}{#if game.retainedCards[player.uid]?.length}<small aria-label={`${player.displayName} kept cards`}>Kept: {game.retainedCards[player.uid].map(cardLabel).join(', ')}</small>{/if}<b>{game.totalScores[player.uid]} total · {game.zeroRounds[player.uid]} zero rounds</b></li>
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
              </GameResultsOverlay>
            {/if}
            <span class="sr-only" data-testid="stream-card-count">Shared stream contains {Object.values(game.hands).flat().length} cards</span>
            <span class="sr-only" data-testid="bot-controller-count">{liveBots.length} bot controllers loaded</span>
          </svelte:fragment>
        </GameTable>
      {:else if activeGameId}
        <GameLobby
          gameId={activeGameId}
          gameName="Rebel Princess"
          players={lobbyPlayers()}
          {currentUid}
          princessOptions={lobbyPrincesses()}
          {selectedPrincess}
          lockPending={princessCommitPending}
          {dealPending}
          lockLabel="Ready for the ball"
          waitingText="Three to six players. The guest list updates live."
          automaticText="Five Round powers will be drawn automatically when the game is dealt."
          {actionError}
          onSelect={(id) => selectedPrincess = id}
          onLock={becomeReady}
          onDeal={dealCards}
          onRemove={removeBot}
          removingUid={removingBotUid}
        >
          <svelte:fragment slot="host-controls">
            {#if game && !Object.keys(game.princessCommitments).length && game.players.length < 6}
              <div class="bot-controls">
                <label for="bot-difficulty">Bot difficulty</label>
                <select id="bot-difficulty" bind:value={botDifficulty} disabled={addingBot}>
                  {#each BOT_DIFFICULTIES as difficulty}<option value={difficulty}>{BOT_DIFFICULTY_LABELS[difficulty]}</option>{/each}
                </select>
                <button class="secondary add-bot" type="button" disabled={addingBot} on:click={addBot}>{addingBot ? 'Adding bot…' : `Add ${BOT_DIFFICULTY_LABELS[botDifficulty]} bot`}</button>
              </div>
            {/if}
            {#if liveBots.length}
              <ul class="bot-status" aria-label="Bot status">
                {#each liveBots as bot}<li><strong>{bot.displayName}</strong><span>{BOT_DIFFICULTY_LABELS[bot.difficulty]} · {bot.status === 'error' ? bot.detail : bot.status}</span></li>{/each}
              </ul>
            {/if}
          </svelte:fragment>
        </GameLobby>
      {:else}
        <GameRoomEntry
          disabled={connection !== 'synced'}
          {actionError}
          bind:displayName
          bind:inviteCode
          bind:selectedVariant
          onCreate={createGame}
          onJoin={joinGame}
        />
      {/if}
    </div>

    {#if !game?.hands}<figure class="atlas-card">
      <div class="alternate-preview-grid">
        {#each previewCards as card}
          <div class="alternate-preview-card">
            <SpriteCard {...cardSpriteProps(card)} />
          </div>
        {/each}
      </div>
      <figcaption style="grid-template-columns: 0.5775fr 0.6248fr 0.6245fr 0.5846fr;">
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

  .audio-controls { position: relative; }
  .audio-toggle { min-height: 34px; padding: 0 11px; display: inline-flex; align-items: center; gap: 5px; border-color: rgba(184, 140, 223, .5); border-radius: 999px; color: #f3e9f5; background: rgba(50, 31, 62, .65); font-size: 12px; }
  .audio-icon { width: 13px; height: 13px; flex: 0 0 13px; fill: currentColor; }
  .audio-toggle[aria-expanded='true'] { border-color: #ffc75f; color: #ffc75f; }
  .audio-mixer { position: absolute; z-index: 30; top: calc(100% + 9px); right: 0; width: 310px; padding: 13px; border: 1px solid rgba(255, 226, 163, .45); border-radius: 9px; color: #f3e9f5; background: rgba(24, 14, 32, .97); box-shadow: 0 16px 36px rgba(0, 0, 0, .55); }
  .mixer-heading, .mixer-channel { display: grid; align-items: center; gap: 9px; }
  .mixer-heading { grid-template-columns: 1fr auto; margin-bottom: 12px; }
  .mixer-heading strong { color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: 20px; }
  .audio-mixer button { min-height: 28px; padding: 0 9px; border-radius: 999px; color: #f3e9f5; background: rgba(80, 49, 94, .7); font-size: 10px; }
  .audio-mixer button[aria-pressed='true'] { border-color: #ffc75f; color: #ffc75f; background: rgba(50, 31, 62, .9); }
  .mixer-channel { grid-template-columns: 1fr 48px; margin-top: 9px; }
  .mixer-channel label { grid-column: 1 / -1; display: flex; justify-content: space-between; color: #d9cedd; font-size: 11px; }
  .mixer-channel output { color: #b88cdf; font-variant-numeric: tabular-nums; }
  .mixer-channel input[type='range'] { width: 100%; min-height: 18px; height: 18px; padding: 0; accent-color: #ffc75f; }

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
  button.secondary { color: #fff4d0; background: transparent; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

  .add-bot { margin: 0 0 8px; }
  .bot-controls { display: grid; grid-template-columns: auto minmax(105px, 1fr) minmax(140px, auto); align-items: center; gap: 8px; margin: 0 0 8px; }
  .bot-controls label { color: #d9cedd; font-size: 12px; font-weight: 700; }
  .bot-controls select { min-width: 0; padding: 7px 9px; border: 1px solid rgba(184, 140, 223, .45); border-radius: 5px; color: #fff4d0; background: #24162f; }
  .bot-controls .add-bot { margin: 0; }
  .bot-status { display: grid; gap: 4px; margin: 0 0 10px; padding: 0; list-style: none; }
  .bot-status li { display: flex; justify-content: space-between; gap: 12px; padding: 5px 8px; border: 1px solid rgba(184, 140, 223, .3); border-radius: 5px; color: #d9cedd; background: rgba(20, 13, 30, .45); font-size: 11px; }
  .bot-status span { color: #b88cdf; text-transform: capitalize; }
  .power-controls { display: flex; justify-content: center; align-items: center; gap: 6px; margin-bottom: 3px; color: #fff4d0; font-size: clamp(10px, 1.5cqh, 13px); }
  .power-controls button { min-height: clamp(30px, 4.2cqh, 38px); padding: 0 10px; font-size: clamp(10px, 1.4cqh, 12px); }
  .power-choice { position: fixed; z-index: 30; top: 56%; left: 50%; width: min(90vw, 720px); max-height: 26vh; flex-wrap: wrap; overflow-y: auto; padding: 8px; border: 1px solid rgba(255, 226, 163, .65); border-radius: 8px; background: rgba(20, 13, 30, .97); transform: translate(-50%, -50%); }
  .power-choice button.chosen { color: #211329; background: #ffc75f; }
  .power-prompt { margin: 0 0 3px; color: #ffc75f; font-size: clamp(10px, 1.5cqh, 13px); font-weight: 700; text-align: center; }
  .card-block-explanation { width: max-content; max-width: calc(100% - 150px); margin: 2px auto 0; color: #e8dcae; font-size: clamp(9px, 1.3cqh, 11px); line-height: 1.2; text-align: center; }
  .pass-controls { min-height: 37px; display: flex; justify-content: center; align-items: center; }
  .pass-submit { min-height: 32px; padding: 0 15px; font-size: 12px; }
  .pass-waiting, .pass-complete { margin: 0; color: #d9cedd; font-size: clamp(11px, 1.55cqh, 14px); text-align: center; }
  .pass-complete { color: #7de2a7; font-weight: 700; }
  .score-card-wrap { width: min(100%, 720px); margin-bottom: 9px; overflow: hidden; border: 1px solid rgba(255, 226, 163, .28); border-radius: 8px; }
  .score-card { width: 100%; table-layout: fixed; border-collapse: collapse; color: #f8edf8; font-size: 11px; text-align: center; }
  .score-card caption { padding: 5px; color: #ffc75f; background: rgba(82, 47, 100, .5); font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 700; }
  .score-card th, .score-card td { padding: 6px 7px; border-top: 1px solid rgba(255, 226, 163, .14); border-right: 1px solid rgba(255, 226, 163, .1); }
  .score-card th:last-child, .score-card td:last-child { border-right: 0; }
  .score-card thead th { color: #d9cedd; background: rgba(20, 13, 30, .48); font-weight: 700; }
  .score-card thead span, .score-card thead small { display: block; }
  .score-card thead i { font-style: normal; }
  .score-card thead small { max-width: 82px; margin-top: 2px; overflow: hidden; color: #a99dac; font-size: 8px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
  .score-card tbody th { position: sticky; left: 0; color: #fff4d0; background: #21152d; text-align: left; }
  .score-card .round-score.filled { color: #211329; background: #ffc75f; font-size: 14px; font-weight: 700; }
  .score-card .round-score.pending { color: #756b7a; background: rgba(20, 13, 30, .35); }
  .score-card .score-total { color: #7de2a7; font-size: 14px; font-weight: 700; }
  .score-card tr.winner th, .score-card tr.winner .score-total { color: #ffc75f; }
  .round-result-list { width: min(100%, 520px); margin: 0; padding: 0; list-style: none; }
  .round-result-list li { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255, 226, 163, .15); font-size: 12px; }
  .round-result-list li span { color: #d8c8dc; }
  .round-result-list li b { color: #ffc75f; }
  .round-result-list li.winner { margin: 2px -8px; padding: 7px 8px; border-radius: 8px; background: rgba(255, 199, 95, .14); }
  .victory { margin: 0 0 8px; color: #ffc75f; font-family: 'Cormorant Garamond', serif; font-size: clamp(22px, 4vw, 36px); font-weight: 700; }
  .result-actions { display: flex; gap: 8px; }
  .result-actions .secondary { min-height: 34px; margin-top: 5px; padding: 0 16px; font-size: 12px; }
  .results-ready { min-height: 34px; margin-top: 5px; padding: 0 16px; font-size: 12px; }

  main.gameplay { width: calc(100% - 24px); height: 100dvh; min-height: 0; overflow: hidden; }
  main.gameplay .hero.dealt { height: calc(100dvh - 54px); min-height: 0; padding: 8px 0 10px; }
  main.gameplay .copy { height: 100%; }
  main.gameplay .eyebrow, main.gameplay h1, main.gameplay .lede, main.gameplay .promise, main.gameplay footer { display: none; }
  :global(body:has(main.gameplay)) { height: 100dvh; overflow: hidden; }

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


  .alternate-preview-grid {
    display: grid;
    grid-template-columns: 0.5775fr 0.6248fr 0.6245fr 0.5846fr;
    width: 100%;
    aspect-ratio: 2.4114 / 1;
    background: #09070c;
  }

  .alternate-preview-card {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
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

    .audio-toggle { min-height: 27px; padding: 0 8px; font-size: 10px; }
    .audio-mixer { width: min(310px, calc(100vw - 28px)); }

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

    main.gameplay .card-block-explanation { max-width: calc(100% - 84px); }

    .score-card th, .score-card td { padding: 5px 2px; }
    .score-card thead i, .score-card thead small { display: none; }
    .score-card tbody th { font-size: 9px; }

    button {
      min-height: 44px;
      padding: 0 16px;
      font-size: 14px;
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
