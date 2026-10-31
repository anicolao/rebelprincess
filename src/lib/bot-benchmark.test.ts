import { describe, expect, it } from 'vitest';
import { benchmarkBotPolicy, benchmarkBotPolicyMatrix } from './bot-benchmark';
import { randomLegalBotPolicy } from './bot-engine';
import { HeuristicBotPolicy } from './bot-heuristic';

describe('deterministic bot benchmark', () => {
  it('rotates the challenger through every seat and reproduces the same report', async () => {
    const options = {
      challenger: new HeuristicBotPolicy(),
      baseline: randomLegalBotPolicy,
      seeds: 2,
      seed: 'benchmark-test'
    };
    const first = await benchmarkBotPolicy(options);
    const second = await benchmarkBotPolicy(options);
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      challengerId: 'heuristic-standard-v1',
      baselineId: 'random-legal-v1',
      seeds: 2,
      games: 6
    });
    expect(first.wins + first.ties + first.losses).toBe(first.games);
  });

  it('runs a reproducible all-player-count promotion matrix with uncertainty', async () => {
    const report = await benchmarkBotPolicyMatrix({
      challenger: new HeuristicBotPolicy(),
      baseline: randomLegalBotPolicy,
      seedsPerPlayerCount: 1,
      seed: 'matrix-test'
    });
    expect(report).toEqual({
      challengerId: 'heuristic-standard-v1',
      baselineId: 'random-legal-v1',
      seeds: 4,
      games: 18,
      meanScoreDifferential: 7.925,
      scoreDifferentialStdDev: 6.7824,
      confidence95: { lower: 4.7917, upper: 11.0583 },
      winRate: 0.9444,
      wins: 17,
      ties: 0,
      losses: 1,
      promoted: false
    });
  }, 10_000);
});
