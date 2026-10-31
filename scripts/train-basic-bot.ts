import { LinearRlBotPolicy, roundUtilities } from '../src/lib/bot-rl';
import { runHeadlessOrdinaryRound } from '../src/lib/bot-engine';

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const episodes = Number(argument('--episodes') ?? 2_000);
const seed = argument('--seed') ?? 'basic-rl-v1';
if (!Number.isInteger(episodes) || episodes <= 0) throw new Error('--episodes must be a positive integer');

const policy = new LinearRlBotPolicy(undefined, { training: true, temperature: 0.9, exploration: 0.06 });
for (let episode = 0; episode < episodes; episode += 1) {
  policy.beginEpisode();
  const result = await runHeadlessOrdinaryRound({
    playerCount: 3 + episode % 4,
    seed: `${seed}:${episode}`,
    policy
  });
  policy.learn(roundUtilities(result.projection), 0.025 / Math.sqrt(1 + episode / 250));
}

const model = policy.exportModel({ id: `basic-rl-${episodes}`, trainedEpisodes: episodes, trainingSeed: seed });
process.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
