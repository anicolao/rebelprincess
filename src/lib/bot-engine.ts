import { isMasqueradeHidden, roundLegalCards } from './round-rules';
import { passInstruction } from './passing';
import { isBeforeTrickPower } from './bat-priority';
import { mulanReplacements, snowWhiteCanZero } from './princess-powers';
import {
  BOT_OBSERVATION_VERSION,
  type BotAction,
  type BotObservation,
  type BotPhase,
  type BotPolicy,
  type BotDecision,
  type SeededRandom
} from './bot-types';
import {
  deriveGame,
  type GameEvent,
  type GameEventPayload,
  type GameEventType,
  type GameProjection
} from './game-events';
import { cardLabel, dealForPlayers, SUITS, type Card } from './setup';
import { choiceCommitment, crystalClearChoiceScope } from './choice-commitment';

function copyCard(card: Card): Card {
  return { suit: card.suit, rank: card.rank };
}

function copyCards(cards: readonly Card[]): Card[] {
  return cards.map(copyCard);
}

function copyRecord<T>(record: Record<string, T>, copy: (value: T) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, copy(value)]));
}

function botPhase(game: GameProjection): BotPhase {
  if (game.gameComplete) return 'game-complete';
  if (game.roundComplete) return 'round-complete';
  if (!game.hands) return 'setup';
  if (!game.passComplete) return 'passing';
  if (game.awaitingRoundAction) return 'round-action';
  if (game.beforeTrickWindow) return 'before-trick';
  if (game.pendingPower || game.pendingMulanUid) return 'power-resolution';
  if (game.currentTurnUid) return 'playing';
  return 'waiting';
}

export function buildBotObservation(game: GameProjection, seatUid: string): BotObservation {
  const observingPlayer = game.players.find((player) => player.uid === seatUid);
  if (!observingPlayer) throw new Error(`Unknown bot seat: ${seatUid}`);
  const activeRoundId = game.roundIds[game.roundIndex] ?? '';
  const ownHand = copyCards(game.hands?.[seatUid] ?? []);
  const pendingPower = game.pendingPower
    ? {
        powerId: game.pendingPower.powerId,
        actorUid: game.pendingPower.actorUid,
        ...(game.pendingPower.targetUid ? { targetUid: game.pendingPower.targetUid } : {}),
        contributorUids: game.pendingPower.cards.map(({ uid }) => uid),
        visibleCards: game.pendingPower.cards
          .filter(({ uid }) => game.pendingPower?.actorUid === seatUid || (game.pendingPower?.powerId === 'sleeping-beauty' && uid === seatUid))
          .map(({ uid, card }) => ({ uid, card: copyCard(card) }))
      }
    : null;
  const trick = game.trick
    ? {
        leaderUid: game.trick.leaderUid,
        plays: game.trick.plays.map((play) => ({
          uid: play.uid,
          card: isMasqueradeHidden(activeRoundId, game.trick!, play.uid, game.players.length) && play.uid !== seatUid
            ? null
            : copyCard(play.card),
          ...(play.effectiveRank === undefined ? {} : { effectiveRank: play.effectiveRank })
        })),
        ...(game.trick.reversed === undefined ? {} : { reversed: game.trick.reversed }),
        ...(game.trick.requiredSuit === undefined ? {} : { requiredSuit: game.trick.requiredSuit }),
        ...(game.trick.forcePrinceLead === undefined ? {} : { forcePrinceLead: game.trick.forcePrinceLead })
      }
    : null;

  return {
    version: BOT_OBSERVATION_VERSION,
    gameId: game.gameId,
    seatUid,
    phase: botPhase(game),
    players: game.players.map((player) => ({
      ...player,
      handSize: game.hands?.[player.uid]?.length ?? 0,
      passSubmitted: Boolean(game.passSubmissions[player.uid]),
      roundActionSubmitted: Boolean(game.roundActionSubmissions[player.uid]),
      roundCardsSubmitted: Boolean(game.roundCardSubmissions[player.uid])
    })),
    ownHand,
    ownPrincessOptions: [...(game.princessOptions[seatUid] ?? [])],
    ownPassSubmission: copyCards(game.passSubmissions[seatUid] ?? []),
    ...(game.roundActionSubmissions[seatUid] ? { ownRoundActionCard: copyCard(game.roundActionSubmissions[seatUid]) } : {}),
    ownRoundCardSubmission: copyCards(game.roundCardSubmissions[seatUid] ?? []),
    ownRetainedCards: copyCards(game.retainedCards[seatUid] ?? []),
    roundIds: [...game.roundIds],
    roundIndex: game.roundIndex,
    activeRoundId,
    trick,
    currentTurnUid: game.currentTurnUid,
    princesBroken: game.princesBroken,
    capturedCounts: { ...game.capturedCounts },
    capturedTricks: Object.fromEntries(Object.entries(game.capturedTricks).map(([uid, tricks]) => [
      uid,
      tricks.map((captured) => captured.map((play) => ({
        uid: play.uid,
        card: copyCard(play.card),
        ...(play.effectiveRank === undefined ? {} : { effectiveRank: play.effectiveRank })
      })))
    ])),
    lastCompletedTrick: game.lastCompletedTrick
      ? {
          winnerUid: game.lastCompletedTrick.winnerUid,
          plays: game.lastCompletedTrick.plays.map((play) => ({
            uid: play.uid,
            card: copyCard(play.card),
            ...(play.effectiveRank === undefined ? {} : { effectiveRank: play.effectiveRank })
          }))
        }
      : null,
    completedTricks: game.completedTricks,
    roundComplete: game.roundComplete,
    roundScores: copyRecord(game.roundScores, (score) => ({ ...score })),
    roundScoreHistory: game.roundScoreHistory.map((scores) => copyRecord(scores, (score) => ({ ...score }))),
    totalScores: { ...game.totalScores },
    nextLeaderUid: game.nextLeaderUid,
    gameComplete: game.gameComplete,
    winnerUids: [...game.winnerUids],
    exhaustedPrincessUids: [...game.exhaustedPrincessUids],
    powerIdsThisTrick: [...game.powerIdsThisTrick],
    pendingMulanUid: game.pendingMulanUid,
    pendingPower,
    batPriorityEnabled: game.batPriorityEnabled,
    batSignals: copyRecord(game.batSignals, (signal) => ({ ...signal })),
    batSignalTargetTrick: game.batSignalTargetTrick,
    beforeTrickWindow: game.beforeTrickWindow
      ? {
          ...game.beforeTrickWindow,
          eligibleUids: [...game.beforeTrickWindow.eligibleUids],
          actedUids: [...game.beforeTrickWindow.actedUids],
          declinedSinceActivation: [...game.beforeTrickWindow.declinedSinceActivation]
        }
      : null,
    visibleForcedCards: Object.fromEntries(Object.entries(game.forcedCards)
      .filter(([uid]) => uid === seatUid || observingPlayer.princessId === 'ice-princess')
      .map(([uid, card]) => [uid, copyCard(card)])),
    awaitingRoundAction: game.awaitingRoundAction,
    revealedSuits: { ...game.revealedSuits },
    princessCommitmentCount: Object.keys(game.princessCommitments).length,
    suitCommitmentCount: Object.keys(game.suitCommitments).length,
    ownPrincessCommitted: Boolean(game.princessCommitments[seatUid]),
    ownSuitCommitted: Boolean(game.suitCommitments[seatUid]),
    haggleWinnerUid: game.haggleWinnerUid,
    blindTransferComplete: game.blindTransferComplete,
    rebelUids: [...game.rebelUids]
  };
}

function combinations<T>(values: readonly T[], count: number, start = 0, chosen: T[] = []): T[][] {
  if (chosen.length === count) return [[...chosen]];
  const results: T[][] = [];
  for (let index = start; index <= values.length - (count - chosen.length); index += 1) {
    chosen.push(values[index]);
    results.push(...combinations(values, count, index + 1, chosen));
    chosen.pop();
  }
  return results;
}

function orderedSelections<T>(values: readonly T[], count: number, chosen: T[] = []): T[][] {
  if (chosen.length === count) return [[...chosen]];
  return values.flatMap((value, index) => orderedSelections([...values.slice(0, index), ...values.slice(index + 1)], count, [...chosen, value]));
}

export function legalBotActions(game: GameProjection, seatUid: string): BotAction[] {
  const player = game.players.find((candidate) => candidate.uid === seatUid);
  if (game.gameComplete || game.roundComplete || !player) return [];
  const hand = game.hands?.[seatUid];
  const powerAvailable = Boolean(player?.princessId && !game.exhaustedPrincessUids.includes(seatUid));
  const signalAction = () => {
    if (!player?.princessId || !powerAvailable || !game.batPriorityEnabled || !isBeforeTrickPower(player.princessId) || game.batSignalTargetTrick === null) return null;
    const signal = game.batSignals[seatUid];
    return signal?.targetTrickIndex === game.batSignalTargetTrick && signal.raised
      ? null
      : { type: 'raise-before-trick-hand', targetTrickIndex: game.batSignalTargetTrick } satisfies BotAction;
  };
  const beforeTrickPowerAction = (windowId?: string): BotAction | null => {
    const powerId = player?.princessId;
    if (!powerId || !powerAvailable || !isBeforeTrickPower(powerId)) return null;
    return ['cinderella', 'pea-princess', 'rapunzel'].includes(powerId)
      ? { type: 'activate-power', powerId, ...(windowId ? { windowId } : {}) }
      : { type: 'begin-before-trick-power', powerId, ...(windowId ? { windowId } : {}) };
  };
  if (!hand) {
    if (game.players.length < 3 || player.ready || game.princessCommitments[seatUid]) return [];
    return (game.princessOptions[seatUid] ?? []).map((princessId) => ({ type: 'choose-princess', princessId }));
  }
  if (!game.passComplete) {
    // Retraction remains a valid human correction, but it is not an action the
    // bot owes the game. Returning it as the sole choice makes a live bot undo
    // every pass while it waits for the other seats.
    if (game.passSubmissions[seatUid]) {
      const signal = signalAction();
      return signal ? [signal] : [];
    }
    const instruction = passInstruction(game.roundIds[game.roundIndex] ?? '');
    const selections = instruction.direction === 'split'
      ? orderedSelections(hand, instruction.count)
      : combinations(hand, instruction.count);
    return selections.map((cards) => ({ type: 'submit-pass', cards: copyCards(cards) }));
  }
  if (game.pendingMulanUid === seatUid) {
    const play = game.trick?.plays.find((candidate) => candidate.uid === seatUid);
    const replacements = play ? mulanReplacements(hand, play) : [];
    return [
      ...replacements.map((card) => ({ type: 'activate-power', powerId: 'mulan', card: copyCard(card) } as BotAction)),
      { type: 'decline-power', powerId: 'mulan' }
    ];
  }
  if (game.pendingPower) {
    const pending = game.pendingPower;
    if (pending.powerId === 'sleeping-beauty' && !pending.cards.some((entry) => entry.uid === seatUid)) {
      return hand.map((card) => ({ type: 'contribute-power-card', powerId: 'sleeping-beauty', card: copyCard(card) }));
    }
    if (pending.actorUid !== seatUid) return [];
    const windowId = game.beforeTrickWindow?.id;
    const powerAction = (details: Omit<Extract<BotAction, { type: 'activate-power' }>, 'type' | 'powerId'>): BotAction => ({
      type: 'activate-power', powerId: pending.powerId, ...(windowId ? { windowId } : {}), ...details
    });
    if (pending.powerId === 'pocahontas' && !pending.targetUid) {
      return game.players.map((candidate) => powerAction({ targetUid: candidate.uid }));
    }
    if (pending.powerId === 'little-mermaid') {
      return SUITS.map((suit) => powerAction({ suit }));
    }
    if (pending.powerId === 'ice-princess' && !pending.targetUid) {
      return game.players.map((candidate) => powerAction({ targetUid: candidate.uid }));
    }
    if (pending.powerId === 'ice-princess' && pending.targetUid) {
      return pending.cards.map(({ card }) => powerAction({ card: copyCard(card) }));
    }
    if (pending.powerId === 'scheherazade' && !pending.targetUid) {
      return game.players.filter((candidate) => candidate.uid !== seatUid).map((candidate) => powerAction({ targetUid: candidate.uid }));
    }
    if (pending.powerId === 'scheherazade' && pending.targetUid) {
      return [
        ...hand.map((card) => powerAction({ card: copyCard(card) })),
        { type: 'decline-power', powerId: 'scheherazade' }
      ];
    }
    if (pending.powerId === 'sleeping-beauty' && pending.cards.length === game.players.length) {
      return orderedSelections(pending.cards.map((entry) => entry.card), pending.cards.length)
        .map((cards) => powerAction({ cards: copyCards(cards) }));
    }
    return [];
  }
  if (game.awaitingRoundAction) {
    if (game.awaitingRoundAction === 'haggle') {
      if (game.haggleWinnerUid !== seatUid) return [];
      const won = game.capturedTricks[seatUid]?.at(-1) ?? [];
      const ownPlay = game.lastCompletedTrick?.plays.find((play) => play.uid === seatUid)?.card;
      const available = won.filter((play) => !ownPlay || cardLabel(play.card) !== cardLabel(ownPlay)).map((play) => play.card);
      return [
        ...hand.flatMap((offered) => available.map((taken) => ({ type: 'swap-haggle-card', offered: copyCard(offered), taken: copyCard(taken) } as BotAction))),
        { type: 'decline-haggle' }
      ];
    }
    if (game.awaitingRoundAction === 'reveal-suit') {
      if (game.suitCommitments[seatUid] || game.revealedSuits[seatUid]) return [];
      return [...new Set(hand.map((card) => card.suit))].map((suit) => ({ type: 'choose-crystal-clear-suit', suit }));
    }
    if (game.roundActionSubmissions[seatUid] || game.roundCardSubmissions[seatUid]) return [];
    if (game.awaitingRoundAction === 'set-aside') return hand.map((card) => ({ type: 'set-aside-round-card', card: copyCard(card) }));
    if (game.awaitingRoundAction === 'musical-pass') return hand.map((card) => ({ type: 'submit-musical-chair-card', card: copyCard(card) }));
    if (game.awaitingRoundAction === 'wedding-gift') return hand.map((card) => ({ type: 'submit-wedding-gift', card: copyCard(card) }));
    if (game.awaitingRoundAction === 'split-hand') {
      return combinations(hand, hand.length / 2).map((cards) => ({ type: 'select-after-party-half', cards: copyCards(cards) }));
    }
    return [];
  }
  if (game.beforeTrickWindow?.priorityUid === seatUid) {
    const usePower = beforeTrickPowerAction(game.beforeTrickWindow.id);
    return [
      ...(usePower ? [usePower] : []),
      { type: 'decline-before-trick-priority', windowId: game.beforeTrickWindow.id }
    ];
  }
  if (game.beforeTrickWindow) return [];
  const signal = signalAction();
  if (game.currentTurnUid !== seatUid || !game.trick) return signal ? [signal] : [];
  const leaderPower = hand.length > 0 && game.trick.plays.length === 0 && game.trick.leaderUid === seatUid ? beforeTrickPowerAction() : null;
  const forced = game.forcedCards[seatUid];
  const cards = forced
    ? hand.filter((card) => cardLabel(card) === cardLabel(forced))
    : roundLegalCards(
        hand,
        game.trick,
        game.princesBroken,
        game.roundIds[game.roundIndex] ?? '',
        game.powerIdsThisTrick.includes('pea-princess')
      );
  const cardActions: BotAction[] = cards.map((card) => ({ type: 'play-card', card: copyCard(card) }));
  if (powerAvailable && player?.princessId === 'snow-white') {
    cardActions.unshift(...cards.filter(snowWhiteCanZero).map((card) => ({ type: 'activate-power', powerId: 'snow-white', card: copyCard(card) } as BotAction)));
  }
  return [...(signal ? [signal] : []), ...(leaderPower ? [leaderPower] : []), ...cardActions];
}

export function policyBotActions(policy: BotPolicy, observation: BotObservation, actions: readonly BotAction[]): BotAction[] {
  if (policy.usesOptionalBeforeTrickPowers) return [...actions];
  return actions.filter((action) => {
    if (action.type === 'raise-before-trick-hand' || action.type === 'begin-before-trick-power') return false;
    if (action.type !== 'activate-power' || !isBeforeTrickPower(action.powerId)) return true;
    return observation.pendingPower?.powerId === action.powerId;
  });
}

export interface BotEventIntent {
  type: GameEventType;
  payload: Omit<GameEventPayload, 'gameId'>;
}

export function botActionToEvent(action: BotAction): BotEventIntent {
  switch (action.type) {
    case 'submit-pass': return { type: 'pass/submitted', payload: { cards: copyCards(action.cards) } };
    case 'retract-pass': return { type: 'pass/retracted', payload: {} };
    case 'raise-before-trick-hand': return { type: 'power/hand-raised', payload: { targetTrickIndex: action.targetTrickIndex } };
    case 'lower-before-trick-hand': return { type: 'power/hand-lowered', payload: { targetTrickIndex: action.targetTrickIndex } };
    case 'decline-before-trick-priority': return { type: 'power/priority-declined', payload: { windowId: action.windowId } };
    case 'begin-before-trick-power': return { type: 'power/activation-started', payload: { powerId: action.powerId, ...(action.windowId ? { windowId: action.windowId } : {}) } };
    case 'activate-power': return { type: 'power/activated', payload: {
      powerId: action.powerId,
      ...(action.windowId ? { windowId: action.windowId } : {}),
      ...(action.targetUid ? { targetUid: action.targetUid } : {}),
      ...(action.suit ? { suit: action.suit } : {}),
      ...(action.card ? { card: copyCard(action.card) } : {}),
      ...(action.cards ? { cards: copyCards(action.cards) } : {})
    } };
    case 'contribute-power-card': return { type: 'power/contributed', payload: { powerId: action.powerId, card: copyCard(action.card) } };
    case 'decline-power': return { type: 'power/declined', payload: { powerId: action.powerId } };
    case 'set-aside-round-card': return { type: 'round/card-set-aside', payload: { card: copyCard(action.card) } };
    case 'submit-musical-chair-card': return { type: 'round/pass-submitted', payload: { card: copyCard(action.card) } };
    case 'select-after-party-half': return { type: 'round/half-selected', payload: { cards: copyCards(action.cards) } };
    case 'submit-wedding-gift': return { type: 'round/gift-submitted', payload: { card: copyCard(action.card) } };
    case 'swap-haggle-card': return { type: 'round/haggle-swapped', payload: { cards: [copyCard(action.offered), copyCard(action.taken)] } };
    case 'decline-haggle': return { type: 'round/haggle-declined', payload: {} };
    case 'play-card': return { type: 'card/played', payload: { card: copyCard(action.card) } };
    case 'choose-princess':
    case 'choose-crystal-clear-suit':
    case 'deal-next-round':
    case 'rematch':
      throw new Error(`${action.type} requires controller-owned setup or commit/reveal state`);
  }
}

export function createSeededRandom(seed: string): SeededRandom {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const next = () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    integer(upperExclusive: number) {
      if (!Number.isInteger(upperExclusive) || upperExclusive <= 0) throw new Error('Random integer bound must be positive');
      return Math.floor(next() * upperExclusive);
    }
  };
}

export const randomLegalBotPolicy: BotPolicy = {
  id: 'random-legal-v1',
  choose(_observation, legalActions, random): BotDecision {
    if (!legalActions.length) throw new Error('Random policy requires at least one legal action');
    return {
      actionIndex: random.integer(legalActions.length),
      policyId: this.id,
      seed: random.seed
    };
  }
};

export interface HeadlessRoundResult {
  events: GameEvent[];
  projection: GameProjection;
  decisionCount: number;
}

export const HEADLESS_FIVE_ROUND_IDS = [
  'once-upon-a-time',
  'magic-beans',
  'masquerade-ball',
  'royal-decree',
  'musical-chairs'
] as const;

function createHeadlessEventStream(playerCount: number, seed: string) {
  if (playerCount < 3 || playerCount > 6) throw new Error('Headless games require 3–6 players');
  const uids = Array.from({ length: playerCount }, (_, index) => `bot-${index + 1}`);
  const events: GameEvent[] = [];
  const actorSequences: Record<string, number> = {};
  let globalSequence = 0;
  const append = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>) => {
    actorSequences[actorUid] = (actorSequences[actorUid] ?? 0) + 1;
    globalSequence += 1;
    events.push({
      id: String(globalSequence).padStart(8, '0'),
      type,
      payload: { gameId: `BOT-${seed}`, ...payload },
      actorUid,
      clientSeq: actorSequences[actorUid],
      createdAt: null,
      schemaVersion: 1,
      reducerVersion: 1
    });
  };
  append('game/created', uids[0], { displayName: 'Bot 1' });
  uids.slice(1).forEach((uid, index) => append('player/joined', uid, { displayName: `Bot ${index + 2}` }));
  return { uids, events, append };
}

function ordinaryCardLocations(game: GameProjection): Card[] {
  return [
    ...Object.values(game.hands ?? {}).flat(),
    ...(game.trick?.plays.map((play) => play.card) ?? []),
    ...Object.values(game.capturedTricks).flat(2).map((play) => play.card),
    ...(game.pendingPower?.powerId === 'sleeping-beauty' ? game.pendingPower.cards.map((entry) => entry.card) : []),
    ...Object.values(game.retainedCards).flat()
  ];
}

function assertOrdinaryCardConservation(game: GameProjection, expectedCards: number): void {
  if (!game.hands) return;
  const cards = ordinaryCardLocations(game);
  const labels = cards.map(cardLabel);
  if (new Set(labels).size !== labels.length) {
    const duplicates = [...new Set(labels.filter((label, index) => labels.indexOf(label) !== index))];
    throw new Error(`Card uniqueness failed in ${game.roundIds[game.roundIndex] ?? ''}: ${duplicates.join(', ')}`);
  }
  const hidden = expectedCards - cards.length;
  const playerCount = game.players.length;
  const startingHandSize = expectedCards / playerCount;
  const roundId = game.roundIds[game.roundIndex] ?? '';
  const permittedHidden = hidden === 0 ||
    (roundId === 'late-to-the-ball' && hidden >= 0 && hidden <= playerCount) ||
    (roundId === 'wedding-gift' && hidden === playerCount) ||
    (roundId === 'after-party' && hidden >= 0 && hidden <= expectedCards / 2 && hidden % (startingHandSize / 2) === 0);
  if (!permittedHidden) throw new Error(`Card conservation failed in ${roundId}: expected ${expectedCards}, found ${cards.length} visible and ${hidden} temporarily reserved`);
}

export async function runHeadlessOrdinaryRound(options: {
  playerCount: number;
  seed: string;
  policy?: BotPolicy;
  maxDecisions?: number;
}): Promise<HeadlessRoundResult> {
  const { playerCount, seed, policy = randomLegalBotPolicy, maxDecisions = 1_000 } = options;
  const { uids, events, append } = createHeadlessEventStream(playerCount, seed);
  const hands = dealForPlayers(uids, `${seed}:deal`);
  const expectedCards = Object.values(hands).flat().length;
  append('game/dealt', uids[0], {
    seed: `${seed}:deal`,
    roundIds: Array.from({ length: 5 }, () => 'once-upon-a-time'),
    hands
  });

  const random = createSeededRandom(`${seed}:policy`);
  let decisionCount = 0;
  while (decisionCount < maxDecisions) {
    const before = deriveGame(events);
    assertOrdinaryCardConservation(before, expectedCards);
    if (before.roundComplete) return { events, projection: before, decisionCount };
    const seatUid = before.passComplete
      ? before.currentTurnUid
      : uids.find((uid) => !before.passSubmissions[uid]) ?? null;
    if (!seatUid) throw new Error(`No acting seat in ${botPhase(before)} phase`);
    const observation = buildBotObservation(before, seatUid);
    const actions = policyBotActions(policy, observation, legalBotActions(before, seatUid));
    if (!actions.length) throw new Error(`No legal action for ${seatUid} in ${botPhase(before)} phase`);
    const decision = await policy.choose(observation, actions, random);
    if (!Number.isInteger(decision.actionIndex) || !actions[decision.actionIndex]) throw new Error(`Policy ${policy.id} returned an invalid action index`);
    const intent = botActionToEvent(actions[decision.actionIndex]);
    append(intent.type, seatUid, intent.payload);
    const after = deriveGame(events);
    if (JSON.stringify(before) === JSON.stringify(after)) throw new Error(`Reducer rejected ${actions[decision.actionIndex].type} from ${seatUid}`);
    decisionCount += 1;
  }
  throw new Error(`Headless round exceeded ${maxDecisions} decisions`);
}

export async function runHeadlessFiveRoundGame(options: {
  playerCount: number;
  seed: string;
  policy?: BotPolicy;
  seatPolicies?: readonly BotPolicy[];
  roundIds?: readonly string[];
  princessIds?: readonly string[];
  maxDecisions?: number;
}): Promise<HeadlessRoundResult> {
  const {
    playerCount,
    seed,
    policy = randomLegalBotPolicy,
    seatPolicies,
    roundIds = HEADLESS_FIVE_ROUND_IDS,
    princessIds,
    maxDecisions = 5_000
  } = options;
  if (roundIds.length !== 5) throw new Error('Headless full games require exactly five Round cards');
  if (seatPolicies && seatPolicies.length !== playerCount) throw new Error('Headless seat policies must match the player count');
  if (princessIds && princessIds.length !== playerCount) throw new Error('Headless Princess assignments must match the player count');
  const { uids, events, append } = createHeadlessEventStream(playerCount, seed);
  princessIds?.forEach((princessId, index) => append('player/configured', uids[index], { princessId, ready: true }));
  const expectedCards = Object.values(dealForPlayers(uids, `${seed}:round-1`)).flat().length;
  const dealRound = (roundIndex: number) => {
    const roundSeed = `${seed}:round-${roundIndex + 1}`;
    append('game/dealt', uids[0], {
      seed: roundSeed,
      roundIds: [...roundIds],
      hands: dealForPlayers(uids, roundSeed),
      batPriority: Boolean(princessIds)
    });
  };
  dealRound(0);

  const random = createSeededRandom(`${seed}:policy`);
  const crystalChoices: Record<string, { suit: Card['suit']; nonce: string }> = {};
  let decisionCount = 0;
  while (decisionCount < maxDecisions) {
    const before = deriveGame(events);
    assertOrdinaryCardConservation(before, expectedCards);
    if (before.gameComplete) return { events, projection: before, decisionCount };
    if (before.roundComplete) {
      const nextRound = before.roundIndex + 1;
      if (nextRound >= roundIds.length) throw new Error('Five completed rounds did not finish the game');
      dealRound(nextRound);
      continue;
    }
    if (before.awaitingRoundAction === 'reveal-suit' && uids.every((uid) => before.suitCommitments[uid]) && uids.every((uid) => crystalChoices[uid])) {
      for (const uid of uids) append('round/suit-revealed', uid, crystalChoices[uid]);
      continue;
    }

    const candidate = uids
      .map((uid, index) => {
        const actingPolicy = seatPolicies?.[index] ?? policy;
        const observation = buildBotObservation(before, uid);
        return { uid, actingPolicy, observation, actions: policyBotActions(actingPolicy, observation, legalBotActions(before, uid)) };
      })
      .find(({ actions }) => actions.length > 0);
    if (!candidate) throw new Error(`No acting seat in ${botPhase(before)} phase: ${JSON.stringify({
      currentTurnUid: before.currentTurnUid,
      activeRoundId: before.roundIds[before.roundIndex],
      trick: before.trick,
      handSizes: Object.fromEntries(Object.entries(before.hands ?? {}).map(([uid, cards]) => [uid, cards.length])),
      currentHand: before.currentTurnUid ? before.hands?.[before.currentTurnUid] : null,
      forcedCards: before.forcedCards,
      pendingMulanUid: before.pendingMulanUid,
      pendingPower: before.pendingPower,
      awaitingRoundAction: before.awaitingRoundAction,
      beforeTrickWindow: before.beforeTrickWindow
    })}`);
    const decision = await candidate.actingPolicy.choose(candidate.observation, candidate.actions, random);
    if (!Number.isInteger(decision.actionIndex) || !candidate.actions[decision.actionIndex]) throw new Error(`Policy ${candidate.actingPolicy.id} returned an invalid action index`);
    const action = candidate.actions[decision.actionIndex];
    if (action.type === 'choose-crystal-clear-suit') {
      const nonce = `${seed}:${before.roundIndex}:${candidate.uid}:crystal-clear`;
      crystalChoices[candidate.uid] = { suit: action.suit, nonce };
      append('round/suit-committed', candidate.uid, {
        commitment: choiceCommitment(crystalClearChoiceScope(before.gameId, before.gameNumber, before.roundIndex, candidate.uid), action.suit, nonce)
      });
    } else if (action.type === 'activate-power' && action.powerId === 'snow-white' && action.card) {
      const activation = botActionToEvent(action);
      append(activation.type, candidate.uid, activation.payload);
      append('card/played', candidate.uid, { card: action.card });
    } else {
      const intent = botActionToEvent(action);
      append(intent.type, candidate.uid, intent.payload);
    }
    const after = deriveGame(events);
    if (JSON.stringify(before) === JSON.stringify(after)) throw new Error(`Reducer rejected ${action.type} from ${candidate.uid}: ${JSON.stringify({
      action,
      phase: botPhase(before),
      activeRoundId: before.roundIds[before.roundIndex],
      princessId: before.players.find((player) => player.uid === candidate.uid)?.princessId,
      pendingPower: before.pendingPower,
      beforeTrickWindow: before.beforeTrickWindow,
      trick: before.trick
    })}`);
    decisionCount += 1;
  }
  throw new Error(`Headless game exceeded ${maxDecisions} decisions`);
}
