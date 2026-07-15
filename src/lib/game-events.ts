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

export const SCHEMA_VERSION = 1;
export const REDUCER_VERSION = 1;

export type GameEventType = 'game/created' | 'player/joined' | 'player/configured' | 'game/dealt';
export type GameEventPayload = {
  gameId: string;
  displayName?: string;
  princessId?: string;
  ready?: boolean;
  seed?: string;
  roundIds?: string[];
  hands?: Record<string, Card[]>;
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
    ['game/created', 'player/joined', 'player/configured', 'game/dealt'].includes(String(event.type)) &&
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
  return typeof payload.seed === 'string' && Array.isArray(payload.roundIds) && payload.roundIds.length === 5 && !!payload.hands && typeof payload.hands === 'object';
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
  let hands: Record<string, Card[]> | null = null;
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
    if (event.type === 'game/dealt') {
      roundIds = event.payload.roundIds ?? [];
      hands = event.payload.hands ?? null;
      seed = event.payload.seed ?? null;
    }
  }

  return { gameId, players: [...players.values()], roundIds, hands, seed };
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
