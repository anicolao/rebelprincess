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
import type { Card } from './setup';
import { passInstruction, resolvePasses } from './passing';
import { breaksPrinces, canPlay, trickWinner, type TrickPlay, type TrickState } from './trick-taking';

export const SCHEMA_VERSION = 1;
export const REDUCER_VERSION = 1;

export type GameEventType = 'game/created' | 'player/joined' | 'player/configured' | 'game/dealt' | 'pass/submitted' | 'pass/retracted' | 'card/played';
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
    ['game/created', 'player/joined', 'player/configured', 'game/dealt', 'pass/submitted', 'pass/retracted', 'card/played'].includes(String(event.type)) &&
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

  for (const event of ordered) {
    gameId ||= event.payload.gameId;
    if ((event.type === 'game/created' || event.type === 'player/joined') && !players.has(event.actorUid)) {
      players.set(event.actorUid, {
        uid: event.actorUid,
        displayName: event.payload.displayName ?? 'Player',
        host: event.type === 'game/created',
        ready: false
      });
    }
    if (event.type === 'player/configured') {
      const player = players.get(event.actorUid);
      if (player) players.set(event.actorUid, { ...player, princessId: event.payload.princessId, ready: event.payload.ready === true });
    }
  }

  const playerList = [...players.values()];
  const deals = ordered.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'game/dealt');
  const emptyCounts = () => Object.fromEntries(playerList.map((player) => [player.uid, 0]));
  const emptyTricks = () => Object.fromEntries(playerList.map((player) => [player.uid, [] as TrickPlay[][]]));
  type RoundProjection = Pick<GameProjection, 'hands' | 'passSubmissions' | 'passComplete' | 'trick' | 'currentTurnUid' | 'princesBroken' | 'capturedCounts' | 'capturedTricks' | 'lastCompletedTrick' | 'completedTricks' | 'roundComplete' | 'roundScores'> & { lastWinnerUid: string | null };
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
    if (roundHands && roundTrick) for (const event of segment.filter((entry) => entry.type === 'card/played')) {
      const card = event.payload.card;
      if (!card || event.actorUid !== turnUid || !roundHands[event.actorUid]?.some((held) => held.suit === card.suit && held.rank === card.rank) || !canPlay(roundHands[event.actorUid], roundTrick, broken, card)) continue;
      broken ||= breaksPrinces(roundTrick, card);
      roundHands[event.actorUid] = roundHands[event.actorUid].filter((held) => held.suit !== card.suit || held.rank !== card.rank);
      roundTrick.plays.push({ uid: event.actorUid, card });
      if (roundTrick.plays.length === playerList.length) {
        const winner = trickWinner(roundTrick);
        counts[winner] += roundTrick.plays.length;
        const completed = roundTrick.plays.map((play) => ({ ...play, card: { ...play.card } }));
        tricks[winner].push(completed);
        latest = { winnerUid: winner, plays: completed };
        lastWinnerUid = winner;
        trickCount += 1;
        roundTrick = { leaderUid: winner, plays: [] };
        turnUid = winner;
      } else turnUid = playerList[(playerList.findIndex((player) => player.uid === event.actorUid) + 1) % playerList.length].uid;
    }
    const finished = Boolean(roundHands && Object.values(roundHands).every((hand) => hand.length === 0));
    const scores = Object.fromEntries(playerList.map((player) => {
      const cards = tricks[player.uid].flat().map((play) => play.card);
      const princes = cards.filter((card) => card.suit === 'princes').length;
      const frog = cards.some((card) => card.suit === 'pets' && card.rank === 8) ? 5 : 0;
      return [player.uid, { princes, frog, total: princes + frog }];
    }));
    return { hands: roundHands, passSubmissions: submissions, passComplete: completePass, trick: roundTrick, currentTurnUid: finished ? null : turnUid, princesBroken: broken, capturedCounts: counts, capturedTricks: tricks, lastCompletedTrick: latest, completedTricks: trickCount, roundComplete: finished, roundScores: scores, lastWinnerUid };
  };
  let leaderUid = playerList[0]?.uid ?? '';
  let active: RoundProjection = { hands: null, passSubmissions: {}, passComplete: false, trick: null, currentTurnUid: null, princesBroken: false, capturedCounts: emptyCounts(), capturedTricks: emptyTricks(), lastCompletedTrick: null, completedTricks: 0, roundComplete: false, roundScores: Object.fromEntries(playerList.map((player) => [player.uid, { princes: 0, frog: 0, total: 0 }])), lastWinnerUid: null };
  const totalScores = emptyCounts();
  deals.forEach(({ event: deal, index }, dealIndex) => {
    const nextIndex = deals[dealIndex + 1]?.index ?? ordered.length;
    const segment = ordered.slice(index + 1, nextIndex);
    active = replayRound(deal, segment, leaderUid);
    roundIds = deal.payload.roundIds ?? roundIds;
    seed = deal.payload.seed ?? seed;
    if (active.roundComplete) for (const player of playerList) totalScores[player.uid] += active.roundScores[player.uid].total;
    if (active.lastWinnerUid) leaderUid = active.lastWinnerUid;
  });
  const roundIndex = Math.max(0, deals.length - 1);
  if (active.roundComplete && deals.length) {
    const finalPlayIndex = ordered.findLastIndex((event) => event.type === 'card/played');
    for (const player of playerList) {
      const refreshed = ordered.slice(finalPlayIndex + 1).findLast((event) => event.type === 'player/configured' && event.actorUid === player.uid);
      player.princessId = refreshed?.payload.princessId;
      player.ready = refreshed?.payload.ready === true;
    }
  }
  const { lastWinnerUid: _lastWinnerUid, ...activeProjection } = active;
  return { gameId, players: playerList, roundIds, seed, ...activeProjection, totalScores, roundIndex, nextLeaderUid: leaderUid || null };
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
