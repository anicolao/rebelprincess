import { describe, expect, it } from 'vitest';
import { botControllerRegistryKey, isBotSeat, readBotControllerRecords, writeBotControllerRecords, type BotControllerRecord } from './bot-controller-registry';

describe('bot controller registry', () => {
  it('round-trips valid controller ownership and rejects malformed or duplicate seats', () => {
    const storage = localStorage;
    const records: BotControllerRecord[] = [
      { seatUid: 'bot-1', displayName: 'RL Bot 1', instanceId: 'instance-1', difficulty: 'standard' },
      { seatUid: 'bot-2', displayName: 'RL Bot 2', instanceId: 'instance-2', emulatorUid: 'emulator-2', difficulty: 'easy' }
    ];
    writeBotControllerRecords(storage, 'ROOM42', 'host', records);
    expect(readBotControllerRecords(storage, 'ROOM42', 'host')).toEqual(records);

    storage.setItem(botControllerRegistryKey('ROOM42', 'host'), JSON.stringify([
      records[0],
      { ...records[0], instanceId: 'duplicate' },
      { displayName: 'missing identity' }
    ]));
    expect(readBotControllerRecords(storage, 'ROOM42', 'host')).toEqual([records[0]]);
  });

  it('loads legacy controller records as learned bots', () => {
    localStorage.setItem(botControllerRegistryKey('LEGACY', 'host'), JSON.stringify([
      { seatUid: 'bot-1', displayName: 'RL Bot 1', instanceId: 'instance-1' }
    ]));
    expect(readBotControllerRecords(localStorage, 'LEGACY', 'host')[0].difficulty).toBe('learned');
  });

  it('recognizes explicit bot seats and legacy reserved bot names', () => {
    expect(isBotSeat({ uid: 'one', displayName: 'Computer', host: false, ready: true, bot: true })).toBe(true);
    expect(isBotSeat({ uid: 'two', displayName: 'RL Bot 2', host: false, ready: true })).toBe(true);
    expect(isBotSeat({ uid: 'three', displayName: 'Jo', host: false, ready: true })).toBe(false);
  });
});
