import { benchmarkBotPolicyMatrix } from '../src/lib/bot-benchmark';
import { HeuristicBotPolicy } from '../src/lib/bot-heuristic';
import { LinearRlBotPolicy, RL_FEATURE_NAMES } from '../src/lib/bot-rl';

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const output = argument('--output');
const verificationSeeds = Number(argument('--verification-seeds') ?? 0);
if (!Number.isInteger(verificationSeeds) || verificationSeeds < 0) {
  throw new Error('--verification-seeds must be a non-negative integer');
}

// These coefficients were selected by deterministic, full-game outcome
// searches in isolated decision families. Keeping the residual sparse makes
// both the training result and every difference from Standard auditable.
const learnedWeights: Record<string, number> = {
  'creates-void': 0.5,
  'leaves-singleton': -0.5,
  'haggle:offered-danger': -2,
  'haggle:taken-danger': 2,
  'mulan:recipient-danger': 1,
  'princess:pocahontas:target-self': -0.1
};

const policy = new LinearRlBotPolicy();
const model = policy.exportModel({
  id: 'learned-outcome-v2',
  trainingGames: 2_420,
  trainingSeed: 'targeted-outcome-search-v1'
});
for (const [name, weight] of Object.entries(learnedWeights)) {
  const index = RL_FEATURE_NAMES.indexOf(name as (typeof RL_FEATURE_NAMES)[number]);
  if (index < 0) throw new Error(`Unknown learned feature ${name}`);
  model.weights[index] = weight;
}

const serialized = `${JSON.stringify(model, null, 2)}\n`;
if (output) await Bun.write(output, serialized);
else process.stdout.write(serialized);

if (verificationSeeds > 0) {
  const report = await benchmarkBotPolicyMatrix({
    challenger: new LinearRlBotPolicy(model),
    baseline: new HeuristicBotPolicy(),
    seedsPerPlayerCount: verificationSeeds,
    seed: 'learned-promotion-v2'
  });
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.promoted) process.exitCode = 1;
}
