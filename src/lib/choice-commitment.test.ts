import { describe, expect, it } from 'vitest';
import { choiceCommitment, crystalClearChoiceScope, princessChoiceScope, sha256 } from './choice-commitment';

describe('sealed choice commitments', () => {
  it('matches standard SHA-256 vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('binds a choice and nonce to one player and phase', () => {
    const princess = princessChoiceScope('MOON42', 0, 'alex');
    const crystal = crystalClearChoiceScope('MOON42', 0, 2, 'alex');
    const committed = choiceCommitment(princess, 'mulan', 'secret');
    expect(committed).toBe(choiceCommitment(princess, 'mulan', 'secret'));
    expect(committed).not.toBe(choiceCommitment(princess, 'alice', 'secret'));
    expect(committed).not.toBe(choiceCommitment(princess, 'mulan', 'different'));
    expect(committed).not.toBe(choiceCommitment(crystal, 'mulan', 'secret'));
  });
});
