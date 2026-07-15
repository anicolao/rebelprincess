import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';

export const SCHEMA_VERSION = 1;
export const REDUCER_VERSION = 1;

export type GameEventType = 'game/created' | 'player/joined';

export interface GameEvent {
  id: string;
  type: GameEventType;
  payload: { gameId: string; displayName: string };
  actorUid: string;
  clientSeq: number;
  createdAt: Timestamp | null;
  schemaVersion: typeof SCHEMA_VERSION;
  reducerVersion: typeof REDUCER_VERSION;
}

export interface GameProjection {
  gameId: string;
  players: Array<{ uid: string; displayName: string; host: boolean }>;
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
  return (
    (event.type === 'game/created' || event.type === 'player/joined') &&
    typeof event.actorUid === 'string' &&
    Number.isInteger(event.clientSeq) &&
    event.schemaVersion === SCHEMA_VERSION &&
    event.reducerVersion === REDUCER_VERSION &&
    !!payload &&
    typeof payload.gameId === 'string' &&
    typeof payload.displayName === 'string'
  );
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
  const players = new Map<string, { uid: string; displayName: string; host: boolean }>();
  let gameId = '';

  for (const event of ordered) {
    gameId ||= event.payload.gameId;
    if (!players.has(event.actorUid)) {
      players.set(event.actorUid, {
        uid: event.actorUid,
        displayName: event.payload.displayName,
        host: event.type === 'game/created'
      });
    }
  }

  return { gameId, players: [...players.values()] };
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
  displayName: string,
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
      payload: { gameId, displayName },
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
