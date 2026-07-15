import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { cardLabel, princessOptionsForPlayers, SUITS, type Card } from './setup';
import { passInstruction, resolvePasses } from './passing';
import { breaksPrinces, trickWinner, type TrickPlay, type TrickState } from './trick-taking';
import { legalCardsWithPeaPower, mulanReplacements, snowWhiteCanZero } from './princess-powers';

export const SCHEMA_VERSION = 1;
export const REDUCER_VERSION = 1;

export type GameEventType = 'game/created' | 'game/rematched' | 'player/joined' | 'player/configured' | 'game/dealt' | 'pass/submitted' | 'pass/retracted' | 'card/played' | 'power/activated' | 'power/declined';
export type GameEventPayload = {
  gameId: string;
  displayName?: string;
  princessId?: string;
  ready?: boolean;
  seed?: string;
  roundIds?: string[];
  hands?: Record<string, Card[]>;
  cards?: Card[];
  card?: Card;
  powerId?: string;
  targetUid?: string;
};

export interface GameEvent {
  id: string;
  type: GameEventType;
  payload: GameEventPayload;
  actorUid: string;
  clientSeq: number;
  createdAt: Timestamp | null;
  schemaVersion: typeof SCHEMA_VERSION;
  reducerVersion: typeof REDUCER_VERSION;
}

export interface GameProjection {
  gameId: string;
  players: Array<{ uid: string; displayName: string; host: boolean; princessId?: string; ready: boolean }>;
  roundIds: string[];
  hands: Record<string, Card[]> | null;
  seed: string | null;
  passSubmissions: Record<string, Card[]>;
  passComplete: boolean;
  trick: TrickState | null;
  currentTurnUid: string | null;
  princesBroken: boolean;
  capturedCounts: Record<string, number>;
  capturedTricks: Record<string, TrickPlay[][]>;
  lastCompletedTrick: { winnerUid: string; plays: TrickPlay[] } | null;
  completedTricks: number;
  roundIndex: number;
  roundComplete: boolean;
  roundScores: Record<string, { princes: number; frog: number; total: number }>;
  totalScores: Record<string, number>;
  nextLeaderUid: string | null;
  princessOptions: Record<string, string[]>;
  gameNumber: number;
  gameComplete: boolean;
  zeroRounds: Record<string, number>;
  winnerUids: string[];
  exhaustedPrincessUids: string[];
  powerIdsThisTrick: string[];
  pendingMulanUid: string | null;
}

export function nextRoundLeader(playerUids: string[], totalScores: Record<string, number>, lastLeaderUid: string): string | null {
  if (!playerUids.length) return null;
  const lowest = Math.min(...playerUids.map((uid) => totalScores[uid] ?? 0));
  const lastIndex = Math.max(0, playerUids.indexOf(lastLeaderUid));
  for (let offset = 1; offset <= playerUids.length; offset += 1) {
    const uid = playerUids[(lastIndex + offset) % playerUids.length];
    if ((totalScores[uid] ?? 0) === lowest) return uid;
  }
  return playerUids[0];
}

export function gameWinners(playerUids: string[], totalScores: Record<string, number>, zeroRounds: Record<string, number>): string[] {
  if (!playerUids.length) return [];
  const lowestScore = Math.min(...playerUids.map((uid) => totalScores[uid] ?? 0));
  const scoreLeaders = playerUids.filter((uid) => (totalScores[uid] ?? 0) === lowestScore);
  const mostZeroRounds = Math.max(...scoreLeaders.map((uid) => zeroRounds[uid] ?? 0));
  return scoreLeaders.filter((uid) => (zeroRounds[uid] ?? 0) === mostZeroRounds);
}

export interface EventCursor {
  createdAtMillis: number | null;
  eventId: string;
}

export function normalizeGameId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function eventId(actorUid: string, clientSeq: number): string {
  return `${actorUid.replace(/[^A-Za-z0-9_-]/g, '_')}-${String(clientSeq).padStart(10, '0')}`;
}

export function isGameEvent(value: unknown): value is Omit<GameEvent, 'id'> {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  const payload = event.payload as Record<string, unknown> | undefined;
  const common = (
    ['game/created', 'game/rematched', 'player/joined', 'player/configured', 'game/dealt', 'pass/submitted', 'pass/retracted', 'card/played', 'power/activated', 'power/declined'].includes(String(event.type)) &&
    typeof event.actorUid === 'string' &&
    Number.isInteger(event.clientSeq) &&
    event.schemaVersion === SCHEMA_VERSION &&
    event.reducerVersion === REDUCER_VERSION &&
    !!payload &&
    typeof payload.gameId === 'string'
  );
  if (!common) return false;
  if (event.type === 'game/created' || event.type === 'player/joined') return typeof payload.displayName === 'string';
  if (event.type === 'player/configured') return typeof payload.princessId === 'string' && typeof payload.ready === 'boolean';
  if (event.type === 'game/dealt') return typeof payload.seed === 'string' && Array.isArray(payload.roundIds) && payload.roundIds.length === 5 && !!payload.hands && typeof payload.hands === 'object';
  if (event.type === 'pass/submitted') return Array.isArray(payload.cards) && payload.cards.length > 0;
  if (event.type === 'card/played') return !!payload.card && typeof payload.card === 'object';
  if (event.type === 'power/activated') return typeof payload.powerId === 'string';
  if (event.type === 'power/declined') return payload.powerId === 'mulan';
  return Object.keys(payload).length === 1;
}

export function orderEvents(events: GameEvent[]): GameEvent[] {
  return [...events].sort((left, right) => {
    const time = (left.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) -
      (right.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER);
    return time || left.id.localeCompare(right.id);
  });
}

export function eventCursor(events: GameEvent[]): EventCursor | null {
  const last = orderEvents(events).at(-1);
  return last ? { createdAtMillis: last.createdAt?.toMillis() ?? null, eventId: last.id } : null;
}

export function deriveGame(events: GameEvent[]): GameProjection {
  const ordered = orderEvents(events);
  const players = new Map<string, { uid: string; displayName: string; host: boolean; princessId?: string; ready: boolean }>();
  let gameId = '';
  let roundIds: string[] = [];
  let seed: string | null = null;
  const lastRematchIndex = ordered.findLastIndex((event) => event.type === 'game/rematched');
  const gameNumber = ordered.filter((event) => event.type === 'game/rematched').length;

  for (const [index, event] of ordered.entries()) {
    gameId ||= event.payload.gameId;
    if ((event.type === 'game/created' || event.type === 'player/joined') && !players.has(event.actorUid)) {
      players.set(event.actorUid, {
        uid: event.actorUid,
        displayName: event.payload.displayName ?? 'Player',
        host: event.type === 'game/created',
        ready: false
      });
    }
    if (event.type === 'player/configured' && index > lastRematchIndex) {
      const player = players.get(event.actorUid);
      if (player) players.set(event.actorUid, { ...player, princessId: event.payload.princessId, ready: event.payload.ready === true });
    }
  }

  const playerList = [...players.values()];
  const princessOptions = princessOptionsForPlayers(playerList.map((player) => player.uid), gameNumber ? `${gameId}:rematch:${gameNumber}` : gameId);
  const deals = ordered.map((event, index) => ({ event, index })).filter(({ event, index }) => event.type === 'game/dealt' && index > lastRematchIndex);
  const emptyCounts = () => Object.fromEntries(playerList.map((player) => [player.uid, 0]));
  const emptyTricks = () => Object.fromEntries(playerList.map((player) => [player.uid, [] as TrickPlay[][]]));
  type RoundProjection = Pick<GameProjection, 'hands' | 'passSubmissions' | 'passComplete' | 'trick' | 'currentTurnUid' | 'princesBroken' | 'capturedCounts' | 'capturedTricks' | 'lastCompletedTrick' | 'completedTricks' | 'roundComplete' | 'roundScores' | 'exhaustedPrincessUids' | 'powerIdsThisTrick' | 'pendingMulanUid'> & { lastWinnerUid: string | null };
  const replayRound = (deal: GameEvent, segment: GameEvent[], leaderUid: string): RoundProjection => {
    let roundHands = deal.payload.hands
      ? Object.fromEntries(Object.entries(deal.payload.hands).map(([uid, cards]) => [uid, cards.map((card) => ({ ...card }))]))
      : null;
    const submissions: Record<string, Card[]> = {};
    for (const event of segment) {
      if (event.type === 'pass/submitted') submissions[event.actorUid] = event.payload.cards ?? [];
      if (event.type === 'pass/retracted') delete submissions[event.actorUid];
    }
    const completePass = Boolean(roundHands && playerList.length >= 3 && playerList.every((player) => submissions[player.uid]));
    const roundNumber = deals.findIndex(({ event }) => event === deal);
    if (completePass && roundHands) roundHands = resolvePasses(playerList.map((player) => player.uid), roundHands, submissions, passInstruction(deal.payload.roundIds?.[roundNumber] ?? ''));
    let roundTrick: TrickState | null = completePass ? { leaderUid, plays: [] } : null;
    let turnUid = roundTrick?.leaderUid ?? null;
    let broken = false;
    let trickCount = 0;
    const counts = emptyCounts();
    const tricks = emptyTricks();
    let latest: { winnerUid: string; plays: TrickPlay[] } | null = null;
    let lastWinnerUid: string | null = null;
    const exhausted = new Set<string>();
    let powersThisTrick: string[] = [];
    let peaActive = false;
    let pendingMulanUid: string | null = null;
    const snowZero = new Map<string, string>();
    const resolveTrick = () => {
      if (!roundTrick || roundTrick.plays.length !== playerList.length) return;
      const winner = trickWinner(roundTrick);
      counts[winner] += roundTrick.plays.length;
      const completed = roundTrick.plays.map((play) => ({ ...play, card: { ...play.card } }));
      tricks[winner].push(completed);
      latest = { winnerUid: winner, plays: completed };
      lastWinnerUid = winner;
      trickCount += 1;
      roundTrick = { leaderUid: winner, plays: [] };
      turnUid = winner;
      pendingMulanUid = null;
      peaActive = false;
      powersThisTrick = [];
    };
    if (roundHands && roundTrick) for (const event of segment.filter((entry) => ['card/played', 'power/activated', 'power/declined'].includes(entry.type))) {
      const player = playerList.find((candidate) => candidate.uid === event.actorUid);
      if (event.type === 'power/declined') {
        if (pendingMulanUid === event.actorUid) resolveTrick();
        continue;
      }
      if (event.type === 'power/activated') {
        const powerId = event.payload.powerId;
        if (!player || player.princessId !== powerId || !powerId) continue;
        if (powerId === 'mulan' && pendingMulanUid === player.uid) {
          if (!event.payload.card || !roundTrick) continue;
          const play = roundTrick.plays.find((entry) => entry.uid === player.uid);
          if (!play || !mulanReplacements(roundHands[player.uid], play).some((card) => cardLabel(card) === cardLabel(event.payload.card!))) continue;
          roundHands[player.uid] = roundHands[player.uid].filter((card) => cardLabel(card) !== cardLabel(event.payload.card!));
          roundHands[player.uid].push(play.card);
          roundHands[player.uid].sort((left, right) => SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit) || left.rank - right.rank);
          play.card = event.payload.card;
          exhausted.add(player.uid);
          powersThisTrick.push(powerId);
          resolveTrick();
          continue;
        }
        if (exhausted.has(player.uid)) continue;
        if (powerId === 'mulan') continue;
        if (powerId === 'snow-white') {
          if (turnUid !== player.uid || !event.payload.card || !snowWhiteCanZero(event.payload.card)) continue;
          if (!legalCardsWithPeaPower(roundHands[player.uid], roundTrick, broken, peaActive).some((card) => cardLabel(card) === cardLabel(event.payload.card!))) continue;
          snowZero.set(player.uid, cardLabel(event.payload.card));
        } else {
          if (roundTrick.plays.length) continue;
          if (powerId === 'cinderella') roundTrick.reversed = true;
        else if (powerId === 'pocahontas') {
          if (!playerList.some((candidate) => candidate.uid === event.payload.targetUid)) continue;
          roundTrick.leaderUid = event.payload.targetUid!;
          turnUid = event.payload.targetUid!;
          } else if (powerId === 'pea-princess') peaActive = true;
          else continue;
        }
        exhausted.add(player.uid);
        powersThisTrick.push(powerId);
        continue;
      }
      const card = event.payload.card;
      if (pendingMulanUid || !card || event.actorUid !== turnUid || !roundHands[event.actorUid]?.some((held) => held.suit === card.suit && held.rank === card.rank) || !legalCardsWithPeaPower(roundHands[event.actorUid], roundTrick, broken, peaActive).some((held) => cardLabel(held) === cardLabel(card))) continue;
      broken ||= breaksPrinces(roundTrick, card);
      roundHands[event.actorUid] = roundHands[event.actorUid].filter((held) => held.suit !== card.suit || held.rank !== card.rank);
      const zero = snowZero.get(event.actorUid) === cardLabel(card);
      roundTrick.plays.push({ uid: event.actorUid, card, ...(zero ? { effectiveRank: 0 } : {}) });
      snowZero.delete(event.actorUid);
      if (roundTrick.plays.length === playerList.length) {
        const mulan = playerList.find((candidate) => candidate.princessId === 'mulan' && !exhausted.has(candidate.uid));
        const mulanPlay = mulan ? roundTrick.plays.find((play) => play.uid === mulan.uid) : undefined;
        if (mulan && mulanPlay && mulanReplacements(roundHands[mulan.uid], mulanPlay).length) {
          pendingMulanUid = mulan.uid;
          turnUid = '';
        } else resolveTrick();
      } else turnUid = playerList[(playerList.findIndex((player) => player.uid === event.actorUid) + 1) % playerList.length].uid;
    }
    const finished = Boolean(roundHands && Object.values(roundHands).every((hand) => hand.length === 0));
    const scores = Object.fromEntries(playerList.map((player) => {
      const cards = tricks[player.uid].flat().map((play) => play.card);
      const princes = cards.filter((card) => card.suit === 'princes').length;
      const frog = cards.some((card) => card.suit === 'pets' && card.rank === 8) ? 5 : 0;
      return [player.uid, { princes, frog, total: princes + frog }];
    }));
    return { hands: roundHands, passSubmissions: submissions, passComplete: completePass, trick: roundTrick, currentTurnUid: finished ? null : turnUid || null, princesBroken: broken, capturedCounts: counts, capturedTricks: tricks, lastCompletedTrick: latest, completedTricks: trickCount, roundComplete: finished, roundScores: scores, lastWinnerUid, exhaustedPrincessUids: [...exhausted], powerIdsThisTrick: powersThisTrick, pendingMulanUid };
  };
  let leaderUid = playerList[0]?.uid ?? '';
  let active: RoundProjection = { hands: null, passSubmissions: {}, passComplete: false, trick: null, currentTurnUid: null, princesBroken: false, capturedCounts: emptyCounts(), capturedTricks: emptyTricks(), lastCompletedTrick: null, completedTricks: 0, roundComplete: false, roundScores: Object.fromEntries(playerList.map((player) => [player.uid, { princes: 0, frog: 0, total: 0 }])), lastWinnerUid: null, exhaustedPrincessUids: [], powerIdsThisTrick: [], pendingMulanUid: null };
  const totalScores = emptyCounts();
  const zeroRounds = emptyCounts();
  deals.forEach(({ event: deal, index }, dealIndex) => {
    const nextIndex = deals[dealIndex + 1]?.index ?? ordered.length;
    const segment = ordered.slice(index + 1, nextIndex);
    active = replayRound(deal, segment, leaderUid);
    roundIds = deal.payload.roundIds ?? roundIds;
    seed = deal.payload.seed ?? seed;
    if (active.roundComplete) {
      for (const player of playerList) {
        totalScores[player.uid] += active.roundScores[player.uid].total;
        if (active.roundScores[player.uid].total === 0) zeroRounds[player.uid] += 1;
      }
      leaderUid = nextRoundLeader(playerList.map((player) => player.uid), totalScores, leaderUid) ?? leaderUid;
    }
  });
  const roundIndex = Math.max(0, deals.length - 1);
  const gameComplete = deals.length === 5 && active.roundComplete;
  let winnerUids: string[] = [];
  if (gameComplete) winnerUids = gameWinners(playerList.map((player) => player.uid), totalScores, zeroRounds);
  const { lastWinnerUid: _lastWinnerUid, ...activeProjection } = active;
  return { gameId, players: playerList, roundIds, seed, ...activeProjection, totalScores, roundIndex, nextLeaderUid: leaderUid || null, princessOptions, gameNumber, gameComplete, zeroRounds, winnerUids };
}

export function replayCacheKey(gameId: string): string {
  return `rebel-princess:game:${gameId}:reducer:${REDUCER_VERSION}`;
}

export function nextClientSequence(uid: string, storage: Storage = localStorage): number {
  const key = `rebel-princess:client-sequence:${uid}`;
  const next = Number(storage.getItem(key) ?? '0') + 1;
  storage.setItem(key, String(next));
  return next;
}

export async function appendGameEvent(
  database: Firestore,
  gameId: string,
  actorUid: string,
  type: GameEventType,
  payload: Omit<GameEventPayload, 'gameId'>,
  clientSeq = nextClientSequence(actorUid)
): Promise<void> {
  const reference = doc(database, 'games', gameId, 'events', eventId(actorUid, clientSeq));
  await runTransaction(database, async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists()) {
      const data = existing.data();
      if (data.actorUid === actorUid && data.clientSeq === clientSeq && data.type === type) return;
      throw new Error('Event identifier collision');
    }
    transaction.set(reference, {
      type,
      payload: { gameId, ...payload },
      actorUid,
      clientSeq,
      createdAt: serverTimestamp(),
      schemaVersion: SCHEMA_VERSION,
      reducerVersion: REDUCER_VERSION
    });
  });
}

export function subscribeToGame(
  database: Firestore,
  gameId: string,
  receive: (projection: GameProjection) => void,
  fail: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(database, 'games', gameId, 'events'),
    (snapshot) => {
      const events = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((event): event is GameEvent => isGameEvent(event));
      const projection = deriveGame(events);
      localStorage.setItem(replayCacheKey(gameId), JSON.stringify(projection));
      receive(projection);
    },
    fail
  );
}

export async function loadGame(database: Firestore, gameId: string): Promise<GameProjection> {
  const snapshot = await getDocs(collection(database, 'games', gameId, 'events'));
  return deriveGame(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((event): event is GameEvent => isGameEvent(event)));
}
