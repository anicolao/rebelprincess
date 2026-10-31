import type { GameProjection } from './game-events';
import { normalizeBotDifficulty, type BotDifficulty } from './bot-policies';

export interface BotControllerRecord {
  seatUid: string;
  displayName: string;
  instanceId: string;
  emulatorUid?: string;
  difficulty: BotDifficulty;
}

export function botControllerRegistryKey(gameId: string, ownerUid: string): string {
  return `rebel-princess:bot-controllers:${gameId}:${ownerUid}`;
}

export function isBotSeat(player: GameProjection['players'][number]): boolean {
  return player.bot === true || /^RL Bot \d+$/.test(player.displayName);
}

export function readBotControllerRecords(storage: Storage, gameId: string, ownerUid: string): BotControllerRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(botControllerRegistryKey(gameId, ownerUid)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((record): record is BotControllerRecord => {
      if (!record || typeof record !== 'object') return false;
      const candidate = record as Partial<BotControllerRecord>;
      if (typeof candidate.seatUid !== 'string' || typeof candidate.displayName !== 'string' || typeof candidate.instanceId !== 'string') return false;
      if (candidate.emulatorUid !== undefined && typeof candidate.emulatorUid !== 'string') return false;
      if (seen.has(candidate.seatUid)) return false;
      seen.add(candidate.seatUid);
      return true;
    }).map((record) => ({ ...record, difficulty: normalizeBotDifficulty(record.difficulty) }));
  } catch {
    return [];
  }
}

export function writeBotControllerRecords(storage: Storage, gameId: string, ownerUid: string, records: readonly BotControllerRecord[]): void {
  storage.setItem(botControllerRegistryKey(gameId, ownerUid), JSON.stringify(records));
}
