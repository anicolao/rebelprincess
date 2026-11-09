import { collection, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { choiceCommitment, princessChoiceScope } from './choice-commitment';
import { isGameEvent, orderEvents, type GameEvent } from './game-events';
import { resolvePasses } from './passing';
import { SUITS, cardLabel, type Card } from './setup';
import {
  ZOMBIE_ROUND_IDS,
  zombieLegalCards,
  zombiePassInstruction,
  zombiePrincess,
  zombiePrincessOptions,
  zombieTrickWinner
} from './zombie';

export type ZombiePhase = 'lobby' | 'pass' | 'set-aside' | 'bid' | 'play' | 'frog' | 'score' | 'round-complete' | 'game-complete';
export type ZombiePlay = { uid: string; card: Card; effectiveRank?: number; pea?: boolean };
export type ZombieCapturedTrick = { index: number; plays: ZombiePlay[] };
export type ZombieRoundScore = {
  bid: number;
  tricks: number;
  bought: number;
  points: number;
  skullsGained: number;
  skullsSpent: number;
  skullsRemaining: number;
};

export interface ZombieProjection {
  variant: 'zombie';
  gameId: string;
  players: Array<{ uid: string; displayName: string; host: boolean; princessId?: string; ready: boolean }>;
  princessOptions: Record<string, string[]>;
  princessCommitments: Record<string, string>;
  roundIds: string[];
  roundIndex: number;
  activeRoundId: string;
  phase: ZombiePhase;
  hands: Record<string, Card[]> | null;
  passSubmissions: Record<string, Card[]>;
  passComplete: boolean;
  setAsideCards: Record<string, Card>;
  bids: Record<string, number>;
  effectiveBids: Record<string, number>;
  currentBidderUid: string | null;
  currentTurnUid: string | null;
  trick: { leaderUid: string; plays: ZombiePlay[] } | null;
  princesBroken: boolean;
  completedTricks: number;
  capturedTricks: Record<string, ZombieCapturedTrick[]>;
  countedTricks: Record<string, number>;
  hiddenTrickIndexes: number[];
  frogOwnerUid: string | null;
  frogTrickIndex: number | null;
  frogCounts: boolean | null;
  exhaustedPrincessUids: string[];
  scoreDecisionUids: string[];
  scoreDecisions: Record<string, number>;
  roundScores: Record<string, ZombieRoundScore>;
  roundScoreHistory: Array<Record<string, ZombieRoundScore>>;
  totalPoints: Record<string, number>;
  skulls: Record<string, number>;
  nextLeaderUid: string | null;
  gameComplete: boolean;
  winnerUids: string[];
}

function sameCard(left: Card, right: Card): boolean {
  return left.suit === right.suit && left.rank === right.rank;
}

function emptyRecord<T>(uids: string[], value: (uid: string) => T): Record<string, T> {
  return Object.fromEntries(uids.map((uid) => [uid, value(uid)]));
}

function clockwiseFrom(uids: string[], firstUid: string): string[] {
  const index = Math.max(0, uids.indexOf(firstUid));
  return [...uids.slice(index), ...uids.slice(0, index)];
}

function nextUid(uids: string[], uid: string): string {
  return uids[(uids.indexOf(uid) + 1) % uids.length];
}

function nextZombieLeader(uids: string[], totals: Record<string, number>, priorLeaderUid: string): string {
  const lowest = Math.min(...uids.map((uid) => totals[uid] ?? 0));
  let uid = priorLeaderUid;
  for (let offset = 0; offset < uids.length; offset += 1) {
    uid = nextUid(uids, uid);
    if ((totals[uid] ?? 0) === lowest) return uid;
  }
  return uids[0];
}

function zombieWinners(uids: string[], totals: Record<string, number>, skulls: Record<string, number>): string[] {
  const high = Math.max(...uids.map((uid) => totals[uid] ?? 0));
  const pointLeaders = uids.filter((uid) => totals[uid] === high);
  const mostSkulls = Math.max(...pointLeaders.map((uid) => skulls[uid] ?? 0));
  return pointLeaders.filter((uid) => skulls[uid] === mostSkulls);
}

type RoundReplay = Omit<ZombieProjection,
  'variant' | 'gameId' | 'players' | 'princessOptions' | 'princessCommitments' | 'roundIds' | 'roundIndex' |
  'roundScoreHistory' | 'totalPoints' | 'skulls' | 'nextLeaderUid' | 'gameComplete' | 'winnerUids'> & {
    pointsAfter: Record<string, number>;
    skullsAfter: Record<string, number>;
  };

function replayZombieRound(
  playerUids: string[],
  princessByUid: Record<string, string | undefined>,
  deal: GameEvent,
  segment: GameEvent[],
  roundIndex: number,
  leaderUid: string,
  priorPoints: Record<string, number>,
  priorSkulls: Record<string, number>
): RoundReplay {
  const activeRoundId = deal.payload.roundIds?.[roundIndex] ?? ZOMBIE_ROUND_IDS[roundIndex] ?? 'a';
  let hands = deal.payload.hands
    ? Object.fromEntries(playerUids.map((uid) => [uid, (deal.payload.hands?.[uid] ?? []).map((card) => ({ ...card }))]))
    : null;
  let phase: ZombiePhase = hands ? 'pass' : 'lobby';
  const passSubmissions: Record<string, Card[]> = {};
  const setAsideCards: Record<string, Card> = {};
  const bids: Record<string, number> = {};
  const effectiveBids: Record<string, number> = {};
  let currentBidderUid: string | null = null;
  let currentTurnUid: string | null = null;
  let trick: RoundReplay['trick'] = null;
  let princesBroken = false;
  let completedTricks = 0;
  const capturedTricks = emptyRecord(playerUids, () => [] as ZombieCapturedTrick[]);
  const hiddenTricks = new Set<number>();
  const exhausted = new Set<string>();
  const armedPowerCards: Record<string, { powerId: string; card: Card }> = {};
  const rapunzelSkulls = emptyRecord(playerUids, () => 0);
  const roundRuleSkulls = emptyRecord(playerUids, () => 0);
  let reservesReleased = false;
  let frogOwnerUid: string | null = null;
  let frogTrickIndex: number | null = null;
  let frogCounts: boolean | null = null;
  const scoreDecisions: Record<string, number> = {};
  let scoreDecisionUids: string[] = [];
  let countedTricks = emptyRecord(playerUids, () => 0);
  let roundScores = emptyRecord(playerUids, (uid) => ({ bid: effectiveBids[uid] ?? 0, tricks: 0, bought: 0, points: 0, skullsGained: 0, skullsSpent: 0, skullsRemaining: priorSkulls[uid] ?? 2 }));
  let pointsAfter = { ...priorPoints };
  let skullsAfter = { ...priorSkulls };

  const beginBidding = () => {
    phase = 'bid';
    currentBidderUid = leaderUid;
  };

  const acceptedCaptured = (uid: string) => capturedTricks[uid].filter((entry) => !hiddenTricks.has(entry.index));

  const computeCountedTricks = () => {
    countedTricks = emptyRecord(playerUids, (uid) => {
      let count = acceptedCaptured(uid).length;
      if (uid === frogOwnerUid && frogCounts === false && frogTrickIndex !== null && !hiddenTricks.has(frogTrickIndex)) count -= 1;
      return Math.max(0, count);
    });
  };

  const princessSkullGainFor = (uid: string) => {
    let gain = rapunzelSkulls[uid];
    const princessId = princessByUid[uid];
    const bid = effectiveBids[uid] ?? bids[uid] ?? 0;
    if (princessId === 'goldilocks' && countedTricks[uid] === bid) gain += 3;
    if (princessId === 'swan-maiden') gain += Math.floor(countedTricks[uid] / 2);
    if (princessId === 'dorothy' && acceptedCaptured(uid).length < capturedTricks[uid].length) gain += 3;
    return gain;
  };

  const roundSkullGainFor = (uid: string) => {
    if (activeRoundId === 'b') {
      return acceptedCaptured(uid).flatMap((entry) => entry.plays)
        .reduce((sum, play) => sum + (play.card.rank === 1 ? 1 : play.card.rank === 2 ? 2 : 0), 0);
    }
    return activeRoundId === 'd' ? roundRuleSkulls[uid] : 0;
  };

  const finalizeScores = () => {
    computeCountedTricks();
    roundScores = emptyRecord(playerUids, (uid) => {
      const bid = effectiveBids[uid] ?? bids[uid] ?? 0;
      const tricks = countedTricks[uid];
      const bought = scoreDecisions[uid] ?? 0;
      const gained = princessSkullGainFor(uid) + roundSkullGainFor(uid);
      const available = (priorSkulls[uid] ?? 2) + gained;
      const buyCost = bought * 3;
      const overtricks = Math.max(0, tricks - bid);
      const spent = Math.min(available, buyCost + overtricks);
      const successfulZero = bid === 0 && tricks === 0;
      const points = successfulZero ? (playerUids.length <= 4 ? 10 : 5) : bid > 0 && tricks + bought >= bid ? bid : 0;
      return { bid, tricks, bought, points, skullsGained: gained, skullsSpent: spent, skullsRemaining: Math.max(0, available - spent) };
    });
    pointsAfter = Object.fromEntries(playerUids.map((uid) => [uid, (priorPoints[uid] ?? 0) + roundScores[uid].points]));
    skullsAfter = Object.fromEntries(playerUids.map((uid) => [uid, roundScores[uid].skullsRemaining]));
    phase = 'round-complete';
    currentBidderUid = null;
    currentTurnUid = null;
  };

  const prepareScoring = () => {
    computeCountedTricks();
    scoreDecisionUids = playerUids.filter((uid) => {
      const bid = effectiveBids[uid] ?? bids[uid] ?? 0;
      if (bid === 0 || countedTricks[uid] >= bid) return false;
      const available = (priorSkulls[uid] ?? 2) + princessSkullGainFor(uid);
      return Math.min(bid - countedTricks[uid], Math.floor(available / 3)) > 0;
    });
    phase = 'score';
    if (!scoreDecisionUids.length) finalizeScores();
  };

  const finishCards = () => {
    const frog = playerUids.flatMap((uid) => capturedTricks[uid].map((entry) => ({ uid, entry })))
      .find(({ entry }) => !hiddenTricks.has(entry.index) && entry.plays.some((play) => play.card.suit === 'pets' && play.card.rank === 6));
    if (frog) {
      frogOwnerUid = frog.uid;
      frogTrickIndex = frog.entry.index;
      phase = 'frog';
      currentTurnUid = null;
    } else prepareScoring();
  };

  const completeTrick = () => {
    if (!trick || trick.plays.length !== playerUids.length || !hands) return;
    const winnerUid = zombieTrickWinner(trick.plays);
    const index = completedTricks;
    capturedTricks[winnerUid].push({ index, plays: trick.plays.map((play) => ({ ...play, card: { ...play.card } })) });
    completedTricks += 1;
    if (princessByUid[winnerUid] === 'rapunzel' && !exhausted.has(winnerUid)) {
      const villagers = trick.plays.filter((play) => play.card.suit === 'fairies').length;
      if (villagers) {
        rapunzelSkulls[winnerUid] += villagers;
        exhausted.add(winnerUid);
      }
    }
    if (activeRoundId === 'd') {
      const liveScores = Object.fromEntries(playerUids.map((uid) => [
        uid,
        (priorPoints[uid] ?? 0) + Math.floor(((priorSkulls[uid] ?? 2) + roundRuleSkulls[uid]) / 2)
      ]));
      const high = Math.max(...Object.values(liveScores));
      if (liveScores[winnerUid] < high) roundRuleSkulls[winnerUid] += 1;
    }
    if (Object.values(hands).every((hand) => hand.length === 0)) {
      if (activeRoundId === 'c' && !reservesReleased && playerUids.every((uid) => setAsideCards[uid])) {
        hands = Object.fromEntries(playerUids.map((uid) => [uid, [{ ...setAsideCards[uid] }]]));
        reservesReleased = true;
        trick = { leaderUid: winnerUid, plays: [] };
        currentTurnUid = winnerUid;
      } else {
        trick = { leaderUid: winnerUid, plays: [] };
        finishCards();
      }
    } else {
      trick = { leaderUid: winnerUid, plays: [] };
      currentTurnUid = winnerUid;
    }
  };

  for (const event of segment) {
    if (!hands) break;
    if (phase === 'pass') {
      if (event.type === 'pass/retracted' && passSubmissions[event.actorUid]) delete passSubmissions[event.actorUid];
      if (event.type === 'pass/submitted' && playerUids.includes(event.actorUid) && !passSubmissions[event.actorUid]) {
        const cards = event.payload.cards ?? [];
        const instruction = zombiePassInstruction(activeRoundId);
        const labels = new Set(cards.map(cardLabel));
        if (cards.length === instruction.count && labels.size === cards.length && cards.every((card) => hands?.[event.actorUid].some((held) => sameCard(held, card)))) {
          passSubmissions[event.actorUid] = cards.map((card) => ({ ...card }));
        }
      }
      if (playerUids.every((uid) => passSubmissions[uid])) {
        hands = resolvePasses(playerUids, hands, passSubmissions, zombiePassInstruction(activeRoundId));
        if (activeRoundId === 'c') phase = 'set-aside'; else beginBidding();
      }
      continue;
    }

    if (phase === 'set-aside') {
      if (event.type === 'round/card-set-aside' && event.payload.card && playerUids.includes(event.actorUid) && !setAsideCards[event.actorUid]) {
        const card = hands[event.actorUid].find((held) => sameCard(held, event.payload.card!));
        if (card) {
          setAsideCards[event.actorUid] = { ...card };
          hands[event.actorUid] = hands[event.actorUid].filter((held) => !sameCard(held, card));
        }
      }
      if (playerUids.every((uid) => setAsideCards[uid])) beginBidding();
      continue;
    }

    if ((phase as ZombiePhase) === 'bid') {
      if (event.type === 'zombie/bid-placed' && event.actorUid === currentBidderUid && Number.isInteger(event.payload.bid)) {
        const bid = Math.max(0, Math.min(deal.payload.hands?.[event.actorUid]?.length ?? 15, event.payload.bid ?? 0));
        bids[event.actorUid] = bid;
        effectiveBids[event.actorUid] = bid;
        if (playerUids.every((uid) => bids[uid] !== undefined)) {
          phase = 'play';
          currentBidderUid = null;
          currentTurnUid = leaderUid;
          trick = { leaderUid, plays: [] };
        } else currentBidderUid = nextUid(playerUids, event.actorUid);
      }
      continue;
    }

    if (phase === 'play' && event.type === 'power/activated' && event.payload.powerId && princessByUid[event.actorUid] === event.payload.powerId && !exhausted.has(event.actorUid)) {
      const powerId = event.payload.powerId;
      if (powerId === 'ice-princess' && trick?.plays.length === 0 && (effectiveBids[event.actorUid] ?? 0) > 0) {
        effectiveBids[event.actorUid] -= 1;
        exhausted.add(event.actorUid);
      } else if (powerId === 'scheherazade' && completedTricks === 3 && trick?.plays.length === 0 && Number.isInteger(event.payload.bid)) {
        effectiveBids[event.actorUid] = Math.max(0, Math.min(deal.payload.hands?.[event.actorUid]?.length ?? 15, event.payload.bid ?? 0));
        exhausted.add(event.actorUid);
      } else if ((powerId === 'pea-princess' || powerId === 'thumbelina') && event.actorUid === currentTurnUid && event.payload.card && hands[event.actorUid].some((held) => sameCard(held, event.payload.card!))) {
        armedPowerCards[event.actorUid] = { powerId, card: { ...event.payload.card } };
        exhausted.add(event.actorUid);
      } else if (powerId === 'dorothy' && Number.isInteger(event.payload.targetTrickIndex)) {
        const target = event.payload.targetTrickIndex ?? -1;
        if (capturedTricks[event.actorUid].some((entry) => entry.index === target) && target === completedTricks - 1) {
          hiddenTricks.add(target);
          exhausted.add(event.actorUid);
        }
      } else if (powerId === 'red-riding-hood' && event.payload.cards?.length === 2) {
        const [offered, taken] = event.payload.cards;
        const offeredCard = hands[event.actorUid].find((held) => sameCard(held, offered));
        const captured = capturedTricks[event.actorUid].flatMap((entry) => entry.plays.map((play) => ({ entry, play }))).find(({ play }) => sameCard(play.card, taken));
        if (offeredCard && captured && taken.suit !== 'princes') {
          hands[event.actorUid] = hands[event.actorUid].filter((held) => !sameCard(held, offeredCard));
          hands[event.actorUid].push({ ...taken });
          captured.play.card = { ...offeredCard };
          hands[event.actorUid].sort((left, right) => SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit) || left.rank - right.rank);
          exhausted.add(event.actorUid);
        }
      }
      continue;
    }

    if (phase === 'play' && event.type === 'card/played' && event.payload.card && event.actorUid === currentTurnUid && trick) {
      const card = hands[event.actorUid].find((held) => sameCard(held, event.payload.card!));
      if (!card) continue;
      const armed = armedPowerCards[event.actorUid];
      const thumbelina = armed?.powerId === 'thumbelina' && sameCard(armed.card, card);
      const cinderella = princessByUid[event.actorUid] === 'cinderella';
      const legal = zombieLegalCards(hands[event.actorUid], trick.plays, princesBroken, cinderella, thumbelina);
      if (!legal.some((candidate) => sameCard(candidate, card))) continue;
      if (trick.plays.length && card.suit === 'princes' && trick.plays[0].card.suit !== 'princes') princesBroken = true;
      hands[event.actorUid] = hands[event.actorUid].filter((held) => !sameCard(held, card));
      const pea = armed?.powerId === 'pea-princess' && sameCard(armed.card, card);
      trick.plays.push({ uid: event.actorUid, card: { ...card }, ...(pea ? { effectiveRank: card.rank + 5, pea: true } : {}) });
      delete armedPowerCards[event.actorUid];
      if (trick.plays.length === playerUids.length) completeTrick();
      else currentTurnUid = nextUid(playerUids, event.actorUid);
      continue;
    }

    if ((phase as ZombiePhase) === 'frog' && event.type === 'zombie/frog-decided' && event.actorUid === frogOwnerUid && event.payload.targetTrickIndex === frogTrickIndex) {
      frogCounts = event.payload.counts === true;
      prepareScoring();
      continue;
    }

    if ((phase as ZombiePhase) === 'score' && event.type === 'zombie/score-decided' && scoreDecisionUids.includes(event.actorUid) && scoreDecisions[event.actorUid] === undefined) {
      computeCountedTricks();
      const bid = effectiveBids[event.actorUid] ?? bids[event.actorUid] ?? 0;
      const available = (priorSkulls[event.actorUid] ?? 2) + princessSkullGainFor(event.actorUid);
      const maximum = Math.min(Math.max(0, bid - countedTricks[event.actorUid]), Math.floor(available / 3));
      scoreDecisions[event.actorUid] = Math.max(0, Math.min(maximum, event.payload.buyTricks ?? 0));
      if (scoreDecisionUids.every((uid) => scoreDecisions[uid] !== undefined)) finalizeScores();
    }
  }

  computeCountedTricks();
  return {
    activeRoundId,
    phase,
    hands,
    passSubmissions,
    passComplete: phase !== 'pass',
    setAsideCards,
    bids,
    effectiveBids,
    currentBidderUid,
    currentTurnUid,
    trick,
    princesBroken,
    completedTricks,
    capturedTricks,
    countedTricks,
    hiddenTrickIndexes: [...hiddenTricks],
    frogOwnerUid,
    frogTrickIndex,
    frogCounts,
    exhaustedPrincessUids: [...exhausted],
    scoreDecisionUids,
    scoreDecisions,
    roundScores,
    pointsAfter,
    skullsAfter
  };
}

export function deriveZombieGame(events: GameEvent[]): ZombieProjection {
  const ordered = orderEvents(events);
  const created = ordered.find((event) => event.type === 'game/created' && event.payload.variant === 'zombie');
  const gameId = created?.payload.gameId ?? ordered[0]?.payload.gameId ?? '';
  const firstDealIndex = ordered.findIndex((event) => event.type === 'game/dealt');
  const players = new Map<string, { uid: string; displayName: string; host: boolean; princessId?: string; ready: boolean }>();
  for (const [index, event] of ordered.entries()) {
    if (!['game/created', 'player/joined'].includes(event.type) || players.has(event.actorUid) || players.size >= 6 || (firstDealIndex >= 0 && index >= firstDealIndex)) continue;
    players.set(event.actorUid, { uid: event.actorUid, displayName: event.payload.displayName ?? 'Player', host: event.type === 'game/created', ready: false });
  }
  const playerList = [...players.values()];
  const playerUids = playerList.map((player) => player.uid);
  const princessOptions = zombiePrincessOptions(playerUids, gameId);
  const princessCommitments: Record<string, string> = {};
  const reveals: Record<string, string> = {};
  const usesCommitments = ordered.some((event) => event.type === 'player/princess-committed');
  for (const event of ordered) {
    if (event.type === 'player/princess-committed' && players.has(event.actorUid) && event.payload.commitment) princessCommitments[event.actorUid] = event.payload.commitment;
    if (event.type !== 'player/configured' || !players.has(event.actorUid)) continue;
    if (!usesCommitments && event.payload.ready) reveals[event.actorUid] = event.payload.princessId ?? '';
    if (usesCommitments && event.payload.ready && event.payload.princessId && event.payload.nonce && playerUids.every((uid) => princessCommitments[uid])) {
      const valid = princessOptions[event.actorUid]?.includes(event.payload.princessId) &&
        choiceCommitment(princessChoiceScope(gameId, 0, event.actorUid), event.payload.princessId, event.payload.nonce) === princessCommitments[event.actorUid];
      if (valid) reveals[event.actorUid] = event.payload.princessId;
    }
  }
  if (playerUids.length >= 3 && playerUids.every((uid) => reveals[uid])) {
    for (const player of playerList) {
      player.princessId = reveals[player.uid];
      player.ready = true;
    }
  }

  const deals = ordered.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'game/dealt' && event.payload.roundIds?.length === 4);
  const roundIds = deals[0]?.event.payload.roundIds ?? [...ZOMBIE_ROUND_IDS];
  const emptyPoints = emptyRecord(playerUids, () => 0);
  let totalPoints = { ...emptyPoints };
  let skulls = emptyRecord(playerUids, () => 2);
  let leaderUid = playerUids[0] ?? '';
  const roundScoreHistory: Array<Record<string, ZombieRoundScore>> = [];
  let active: RoundReplay | null = null;
  const princessByUid = Object.fromEntries(playerList.map((player) => [player.uid, player.princessId]));
  for (const [roundIndex, deal] of deals.entries()) {
    const nextIndex = deals[roundIndex + 1]?.index ?? ordered.length;
    active = replayZombieRound(playerUids, princessByUid, deal.event, ordered.slice(deal.index + 1, nextIndex), roundIndex, leaderUid, totalPoints, skulls);
    if (active.phase === 'round-complete') {
      roundScoreHistory.push(active.roundScores);
      totalPoints = active.pointsAfter;
      skulls = active.skullsAfter;
      leaderUid = nextZombieLeader(playerUids, totalPoints, leaderUid);
    }
  }

  const roundIndex = Math.max(0, deals.length - 1);
  const gameComplete = deals.length === 4 && active?.phase === 'round-complete';
  if (gameComplete) {
    totalPoints = Object.fromEntries(playerUids.map((uid) => [uid, totalPoints[uid] + Math.floor((skulls[uid] ?? 0) / 2)]));
  }
  const fallbackScores = emptyRecord(playerUids, (uid) => ({ bid: 0, tricks: 0, bought: 0, points: 0, skullsGained: 0, skullsSpent: 0, skullsRemaining: skulls[uid] ?? 2 }));
  const fallbackTricks = emptyRecord(playerUids, () => [] as ZombieCapturedTrick[]);
  return {
    variant: 'zombie',
    gameId,
    players: playerList,
    princessOptions,
    princessCommitments,
    roundIds,
    roundIndex,
    activeRoundId: active?.activeRoundId ?? roundIds[roundIndex] ?? 'a',
    phase: gameComplete ? 'game-complete' : active?.phase ?? 'lobby',
    hands: active?.hands ?? null,
    passSubmissions: active?.passSubmissions ?? {},
    passComplete: active?.passComplete ?? false,
    setAsideCards: active?.setAsideCards ?? {},
    bids: active?.bids ?? {},
    effectiveBids: active?.effectiveBids ?? {},
    currentBidderUid: active?.currentBidderUid ?? null,
    currentTurnUid: active?.currentTurnUid ?? null,
    trick: active?.trick ?? null,
    princesBroken: active?.princesBroken ?? false,
    completedTricks: active?.completedTricks ?? 0,
    capturedTricks: active?.capturedTricks ?? fallbackTricks,
    countedTricks: active?.countedTricks ?? emptyPoints,
    hiddenTrickIndexes: active?.hiddenTrickIndexes ?? [],
    frogOwnerUid: active?.frogOwnerUid ?? null,
    frogTrickIndex: active?.frogTrickIndex ?? null,
    frogCounts: active?.frogCounts ?? null,
    exhaustedPrincessUids: active?.exhaustedPrincessUids ?? [],
    scoreDecisionUids: active?.scoreDecisionUids ?? [],
    scoreDecisions: active?.scoreDecisions ?? {},
    roundScores: active?.roundScores ?? fallbackScores,
    roundScoreHistory,
    totalPoints,
    skulls,
    nextLeaderUid: leaderUid || null,
    gameComplete,
    winnerUids: gameComplete ? zombieWinners(playerUids, totalPoints, skulls) : []
  };
}

function isZombieEvent(value: unknown): value is GameEvent {
  return isGameEvent(value);
}

export function subscribeToZombieGame(database: Firestore, gameId: string, receive: (projection: ZombieProjection) => void, fail: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(database, 'games', gameId, 'events'), (snapshot) => {
    const events = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter(isZombieEvent);
    receive(deriveZombieGame(events));
  }, fail);
}
