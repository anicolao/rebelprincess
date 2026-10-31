import type { BotAction, BotDecision, BotObservation, BotPolicy, SeededRandom } from './bot-types';
import type { Card } from './setup';

export const BASIC_RL_MODEL_FORMAT = 'rebel-princess-linear-policy-v1' as const;

export const RL_FEATURE_NAMES = [
  'bias',
  'submit-pass',
  'play-card',
  'round-action',
  'mean-rank',
  'high-rank',
  'prince-count',
  'frog-count',
  'fairy-count',
  'queen-count',
  'pet-count',
  'creates-void',
  'leading',
  'following-led-suit',
  'would-win-visible-trick',
  'visible-trick-penalty',
  'hand-size',
  'fairies-action',
  'queens-action',
  'princes-action',
  'pets-action'
] as const;

export interface BasicRlModel {
  format: typeof BASIC_RL_MODEL_FORMAT;
  id: string;
  trainedEpisodes: number;
  trainingSeed: string;
  featureNames: string[];
  weights: number[];
}

interface TrainingDecision {
  seatUid: string;
  chosen: number;
  features: number[][];
  probabilities: number[];
}

function actionCards(action: BotAction): Card[] {
  switch (action.type) {
    case 'submit-pass':
    case 'select-after-party-half': return action.cards;
    case 'play-card':
    case 'set-aside-round-card':
    case 'submit-musical-chair-card':
    case 'submit-wedding-gift':
    case 'contribute-power-card': return [action.card];
    case 'swap-haggle-card': return [action.offered];
    case 'activate-power': return action.cards ?? (action.card ? [action.card] : []);
    default: return [];
  }
}

function actionSuit(action: BotAction, cards: Card[]): Card['suit'] | undefined {
  if (action.type === 'choose-crystal-clear-suit' || action.type === 'activate-power') return action.suit ?? cards[0]?.suit;
  return cards[0]?.suit;
}

export function rlActionFeatures(observation: BotObservation, action: BotAction): number[] {
  const cards = actionCards(action);
  const meanRank = cards.length ? cards.reduce((sum, card) => sum + card.rank, 0) / cards.length / 12 : 0;
  const highRank = cards.length ? Math.max(...cards.map((card) => card.rank)) / 12 : 0;
  const count = (suit: Card['suit'], rank?: number) => cards.filter((card) => card.suit === suit && (rank === undefined || card.rank === rank)).length;
  const passedBySuit = new Map<Card['suit'], number>();
  for (const card of cards) passedBySuit.set(card.suit, (passedBySuit.get(card.suit) ?? 0) + 1);
  const createsVoid = action.type === 'submit-pass' && [...passedBySuit].some(([suit, outgoing]) =>
    observation.ownHand.filter((card) => card.suit === suit).length === outgoing
  ) ? 1 : 0;
  const played = action.type === 'play-card' ? action.card : undefined;
  const visiblePlays = observation.trick?.plays.filter((play) => play.card !== null) ?? [];
  const ledSuit = visiblePlays[0]?.card?.suit;
  const ledRanks = visiblePlays.filter((play) => play.card?.suit === ledSuit).map((play) => play.effectiveRank ?? play.card!.rank);
  const playedRank = played?.rank ?? 0;
  const reversed = observation.trick?.reversed === true;
  const wouldWin = played && (!ledSuit || played.suit === ledSuit) &&
    (!ledRanks.length || (reversed ? playedRank < Math.min(...ledRanks) : playedRank > Math.max(...ledRanks))) ? 1 : 0;
  const visiblePenalty = visiblePlays.reduce((sum, play) => sum + (play.card?.suit === 'princes' ? 1 : 0) + (play.card?.suit === 'pets' && play.card.rank === 8 ? 5 : 0), 0) / 10;
  const suit = actionSuit(action, cards);
  const isRoundAction = ['set-aside-round-card', 'submit-musical-chair-card', 'choose-crystal-clear-suit', 'select-after-party-half', 'submit-wedding-gift', 'swap-haggle-card', 'decline-haggle'].includes(action.type);

  return [
    1,
    action.type === 'submit-pass' ? 1 : 0,
    action.type === 'play-card' ? 1 : 0,
    isRoundAction ? 1 : 0,
    meanRank,
    highRank,
    count('princes') / 3,
    count('pets', 8),
    count('fairies') / 3,
    count('queens') / 3,
    count('pets') / 3,
    createsVoid,
    played && observation.trick?.plays.length === 0 ? 1 : 0,
    played && ledSuit === played.suit ? 1 : 0,
    wouldWin,
    visiblePenalty,
    observation.ownHand.length / 12,
    suit === 'fairies' ? 1 : 0,
    suit === 'queens' ? 1 : 0,
    suit === 'princes' ? 1 : 0,
    suit === 'pets' ? 1 : 0
  ];
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function probabilities(scores: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const maximum = Math.max(...scores);
    const first = scores.indexOf(maximum);
    return scores.map((_, index) => index === first ? 1 : 0);
  }
  const maximum = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp((score - maximum) / temperature));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function sample(values: number[], random: SeededRandom): number {
  let threshold = random.next();
  for (let index = 0; index < values.length; index += 1) {
    threshold -= values[index];
    if (threshold <= 0) return index;
  }
  return values.length - 1;
}

export class LinearRlBotPolicy implements BotPolicy {
  readonly id: string;
  private weights: number[];
  private episode: TrainingDecision[] = [];

  constructor(
    model?: BasicRlModel,
    private readonly options: { training?: boolean; temperature?: number; exploration?: number } = {}
  ) {
    if (model && (model.format !== BASIC_RL_MODEL_FORMAT || model.featureNames.join('|') !== RL_FEATURE_NAMES.join('|') || model.weights.length !== RL_FEATURE_NAMES.length)) {
      throw new Error('Incompatible basic RL model');
    }
    this.id = model?.id ?? 'basic-rl-untrained';
    this.weights = model ? [...model.weights] : RL_FEATURE_NAMES.map(() => 0);
  }

  beginEpisode(): void {
    this.episode = [];
  }

  choose(observation: BotObservation, legalActions: readonly BotAction[], random: SeededRandom): BotDecision {
    if (!legalActions.length) throw new Error('RL policy requires at least one legal action');
    const featureRows = legalActions.map((action) => rlActionFeatures(observation, action));
    const scores = featureRows.map((features) => dot(this.weights, features));
    const distribution = probabilities(scores, this.options.temperature ?? (this.options.training ? 0.85 : 0));
    const explore = this.options.training === true && random.next() < (this.options.exploration ?? 0.04);
    const actionIndex = explore ? random.integer(legalActions.length) : sample(distribution, random);
    if (this.options.training) this.episode.push({ seatUid: observation.seatUid, chosen: actionIndex, features: featureRows, probabilities: distribution });
    return {
      actionIndex,
      policyId: this.id,
      seed: random.seed,
      diagnostics: { score: scores[actionIndex], candidates: legalActions.length, explored: explore }
    };
  }

  learn(rewards: Record<string, number>, learningRate: number): void {
    for (const decision of this.episode) {
      const advantage = Math.max(-2, Math.min(2, (rewards[decision.seatUid] ?? 0) / 5));
      for (let feature = 0; feature < this.weights.length; feature += 1) {
        const expectation = decision.features.reduce((sum, row, action) => sum + decision.probabilities[action] * row[feature], 0);
        this.weights[feature] += learningRate * advantage * (decision.features[decision.chosen][feature] - expectation);
      }
    }
    this.episode = [];
  }

  exportModel(details: { id: string; trainedEpisodes: number; trainingSeed: string }): BasicRlModel {
    return {
      format: BASIC_RL_MODEL_FORMAT,
      id: details.id,
      trainedEpisodes: details.trainedEpisodes,
      trainingSeed: details.trainingSeed,
      featureNames: [...RL_FEATURE_NAMES],
      weights: this.weights.map((weight) => Number(weight.toFixed(8)))
    };
  }
}

export function roundUtilities(observation: { players: Array<{ uid: string }>; roundScores: Record<string, { total: number }> }): Record<string, number> {
  return Object.fromEntries(observation.players.map((player) => {
    const opponents = observation.players.filter((candidate) => candidate.uid !== player.uid);
    const opponentMean = opponents.reduce((sum, opponent) => sum + (observation.roundScores[opponent.uid]?.total ?? 0), 0) / opponents.length;
    return [player.uid, opponentMean - (observation.roundScores[player.uid]?.total ?? 0)];
  }));
}
