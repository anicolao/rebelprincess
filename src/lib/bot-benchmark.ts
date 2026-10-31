import { runHeadlessFiveRoundGame } from './bot-engine';
import type { BotPolicy } from './bot-types';
import { PRINCESSES, ROUND_RULES } from './setup';

export interface BotBenchmarkResult {
  challengerId: string;
  baselineId: string;
  seeds: number;
  games: number;
  meanScoreDifferential: number;
  scoreDifferentialStdDev: number;
  confidence95: { lower: number; upper: number };
  winRate: number;
  wins: number;
  ties: number;
  losses: number;
  promoted: boolean;
}

function summarize(challengerId: string, baselineId: string, seeds: number, differentials: number[]): BotBenchmarkResult {
  const games = differentials.length;
  const mean = differentials.reduce((sum, value) => sum + value, 0) / games;
  const variance = games > 1
    ? differentials.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (games - 1)
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const margin = 1.96 * standardDeviation / Math.sqrt(games);
  const wins = differentials.filter((value) => value > 0).length;
  const ties = differentials.filter((value) => value === 0).length;
  const losses = games - wins - ties;
  const lower = mean - margin;
  return {
    challengerId,
    baselineId,
    seeds,
    games,
    meanScoreDifferential: Number(mean.toFixed(4)),
    scoreDifferentialStdDev: Number(standardDeviation.toFixed(4)),
    confidence95: { lower: Number(lower.toFixed(4)), upper: Number((mean + margin).toFixed(4)) },
    winRate: Number((wins / games).toFixed(4)),
    wins,
    ties,
    losses,
    promoted: games >= 120 && lower > 0 && wins / games > 0.5
  };
}

export async function benchmarkBotPolicy(options: {
  challenger: BotPolicy;
  baseline: BotPolicy;
  seeds: number;
  playerCount?: number;
  seed?: string;
  roundIds?: readonly string[];
  princessIds?: readonly string[];
}): Promise<BotBenchmarkResult> {
  const { challenger, baseline, seeds, playerCount = 3, seed = 'bot-benchmark-v1', roundIds, princessIds } = options;
  if (!Number.isInteger(seeds) || seeds <= 0) throw new Error('Benchmark seeds must be a positive integer');
  if (playerCount < 3 || playerCount > 6) throw new Error('Benchmarks require 3–6 players');
  const differentials: number[] = [];
  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    for (let seat = 0; seat < playerCount; seat += 1) {
      const policies = Array.from({ length: playerCount }, (_, index) => index === seat ? challenger : baseline);
      const result = await runHeadlessFiveRoundGame({
        playerCount,
        seed: `${seed}:${seedIndex}`,
        seatPolicies: policies,
        ...(roundIds ? { roundIds } : {}),
        ...(princessIds ? { princessIds } : {})
      });
      const uid = result.projection.players[seat].uid;
      const score = result.projection.totalScores[uid] ?? 0;
      const opponentScores = result.projection.players.filter((_, index) => index !== seat).map((player) => result.projection.totalScores[player.uid] ?? 0);
      const opponentMean = opponentScores.reduce((sum, value) => sum + value, 0) / opponentScores.length;
      const gameDifferential = opponentMean - score;
      differentials.push(gameDifferential);
    }
  }
  return summarize(challenger.id, baseline.id, seeds, differentials);
}

export async function benchmarkBotPolicyMatrix(options: {
  challenger: BotPolicy;
  baseline: BotPolicy;
  seedsPerPlayerCount: number;
  seed?: string;
}): Promise<BotBenchmarkResult> {
  const { challenger, baseline, seedsPerPlayerCount, seed = 'bot-promotion-v1' } = options;
  if (!Number.isInteger(seedsPerPlayerCount) || seedsPerPlayerCount <= 0) throw new Error('Matrix benchmark seeds must be a positive integer');
  const roundPool = ROUND_RULES.map(([id]) => id);
  const princessPool = PRINCESSES.map(([id]) => id);
  const differentials: number[] = [];
  for (const playerCount of [3, 4, 5, 6]) {
    for (let seedIndex = 0; seedIndex < seedsPerPlayerCount; seedIndex += 1) {
      const roundOffset = (seedIndex * 5 + playerCount) % roundPool.length;
      const princessOffset = (seedIndex * playerCount + playerCount) % princessPool.length;
      const roundIds = Array.from({ length: 5 }, (_, index) => roundPool[(roundOffset + index) % roundPool.length]);
      const princessIds = Array.from({ length: playerCount }, (_, index) => princessPool[(princessOffset + index) % princessPool.length]);
      for (let seat = 0; seat < playerCount; seat += 1) {
        const policies = Array.from({ length: playerCount }, (_, index) => index === seat ? challenger : baseline);
        const result = await runHeadlessFiveRoundGame({
          playerCount,
          seed: `${seed}:${playerCount}:${seedIndex}`,
          roundIds,
          princessIds,
          seatPolicies: policies
        });
        const uid = result.projection.players[seat].uid;
        const score = result.projection.totalScores[uid] ?? 0;
        const opponents = result.projection.players.filter((_, index) => index !== seat);
        const opponentMean = opponents.reduce((sum, player) => sum + (result.projection.totalScores[player.uid] ?? 0), 0) / opponents.length;
        differentials.push(opponentMean - score);
      }
    }
  }
  return summarize(challenger.id, baseline.id, seedsPerPlayerCount * 4, differentials);
}
