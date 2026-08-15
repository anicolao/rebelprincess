import { describe, expect, it } from 'vitest';
import { completeBeforeTrickPower, createBeforeTrickWindow, declineBeforeTrickPriority, isBeforeTrickPower } from './bat-priority';

describe('before-trick rolling priority', () => {
  const players = ['alex', 'jo', 'sam'];

  it('starts with the leader or the next eligible seat', () => {
    expect(createBeforeTrickWindow('w', players, 'jo', players)?.priorityUid).toBe('jo');
    expect(createBeforeTrickWindow('w', players, 'jo', ['alex', 'sam'])?.priorityUid).toBe('sam');
  });

  it('closes after one uninterrupted circuit of declines', () => {
    const opened = createBeforeTrickWindow('w', players, 'alex', players)!;
    const afterAlex = declineBeforeTrickPriority(opened, players, 'alex')!;
    const afterJo = declineBeforeTrickPriority(afterAlex, players, 'jo')!;
    expect(afterJo.priorityUid).toBe('sam');
    expect(declineBeforeTrickPriority(afterJo, players, 'sam')).toBeNull();
  });

  it('lets an earlier decliner reconsider after another player acts', () => {
    const opened = createBeforeTrickWindow('w', players, 'alex', players)!;
    const afterAlex = declineBeforeTrickPriority(opened, players, 'alex')!;
    const afterJo = completeBeforeTrickPower(afterAlex, players, 'jo')!;
    expect(afterJo).toMatchObject({ priorityUid: 'sam', actedUids: ['jo'], declinedSinceActivation: [] });
    const afterSam = declineBeforeTrickPriority(afterJo, players, 'sam')!;
    expect(afterSam.priorityUid).toBe('alex');
    expect(declineBeforeTrickPriority(afterSam, players, 'alex')).toBeNull();
  });

  it('skips players who already acted on later circuits', () => {
    const opened = createBeforeTrickWindow('w', players, 'alex', players)!;
    const afterAlex = completeBeforeTrickPower(opened, players, 'alex')!;
    const afterJo = completeBeforeTrickPower(afterAlex, players, 'jo')!;
    expect(afterJo.priorityUid).toBe('sam');
    expect(completeBeforeTrickPower(afterJo, players, 'sam')).toBeNull();
  });

  it('recognizes only printed before-trick powers', () => {
    expect(isBeforeTrickPower('sleeping-beauty')).toBe(true);
    expect(isBeforeTrickPower('mulan')).toBe(false);
  });
});
