import { choiceCommitment, crystalClearChoiceScope, princessChoiceScope } from './choice-commitment';
import { botActionToEvent, buildBotObservation, createSeededRandom, legalBotActions, policyBotActions } from './bot-engine';
import { createBotPolicy, type BotDifficulty } from './bot-policies';
import type { BotAction, BotPolicy } from './bot-types';
import { appendGameEvent, loadGame, subscribeToGame, type GameProjection } from './game-events';
import { createIsolatedFirebaseClient, type IsolatedFirebaseClient } from './firebase';

export type LiveBotStatus = 'starting' | 'joining' | 'choosing' | 'waiting' | 'acting' | 'stopped' | 'error';

export interface LiveBotState {
  uid: string;
  displayName: string;
  difficulty: BotDifficulty;
  status: LiveBotStatus;
  detail: string;
}

type StoredChoice = { choice: string; nonce: string };

function storedChoiceKey(kind: 'princess' | 'crystal-clear', game: GameProjection, uid: string): string {
  const phase = kind === 'princess' ? game.gameNumber : `${game.gameNumber}:${game.roundIndex}`;
  return `rebel-princess:sealed-choice:${kind}:${game.gameId}:${phase}:${uid}`;
}

function actionKey(action: BotAction): string {
  return JSON.stringify(action);
}

export function botDecisionKey(game: GameProjection, uid: string, actions: readonly BotAction[]): string {
  return JSON.stringify({
    gameNumber: game.gameNumber,
    roundIndex: game.roundIndex,
    completedTricks: game.completedTricks,
    hand: game.hands?.[uid] ?? null,
    pass: game.passSubmissions[uid] ?? null,
    turn: game.currentTurnUid,
    beforeTrickWindow: game.beforeTrickWindow,
    pendingMulanUid: game.pendingMulanUid,
    pendingPower: game.pendingPower,
    awaitingRoundAction: game.awaitingRoundAction,
    roundAction: game.roundActionSubmissions[uid] ?? null,
    roundCards: game.roundCardSubmissions[uid] ?? null,
    commitments: [game.princessCommitments[uid] ?? null, game.suitCommitments[uid] ?? null],
    actions: actions.map(actionKey)
  });
}

export class LiveBotController {
  private client: IsolatedFirebaseClient | null = null;
  private unsubscribe = () => {};
  private stopped = false;
  private processing = false;
  private latestProjection: GameProjection | null = null;
  private lastDecisionKey = '';
  private princessChoice: StoredChoice | null = null;
  private crystalChoice: StoredChoice | null = null;
  private releaseLease: (() => void) | null = null;
  private leaseRequest: Promise<void> | null = null;
  private policy: BotPolicy;
  private state: LiveBotState;

  constructor(
    private readonly options: {
      gameId: string;
      displayName: string;
      difficulty?: BotDifficulty;
      instanceId: string;
      emulatorUid?: string;
      seatUid?: string;
      storage?: Storage;
      claimSeat?: (controllerUid: string) => Promise<void>;
      policy?: BotPolicy;
      receiveState?: (state: LiveBotState) => void;
    }
  ) {
    const difficulty = options.difficulty ?? 'learned';
    this.policy = options.policy ?? createBotPolicy(difficulty);
    this.state = { uid: '', displayName: options.displayName, difficulty, status: 'starting', detail: `Starting ${difficulty} policy` };
  }

  private update(status: LiveBotStatus, detail: string): void {
    this.state = { ...this.state, status, detail };
    this.options.receiveState?.({ ...this.state });
  }

  getState(): LiveBotState {
    return { ...this.state };
  }

  private storage(): Storage | null {
    return this.options.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
  }

  private readChoice(kind: 'princess' | 'crystal-clear', game: GameProjection, uid: string): StoredChoice | null {
    try {
      const value = JSON.parse(this.storage()?.getItem(storedChoiceKey(kind, game, uid)) ?? 'null');
      return value && typeof value.choice === 'string' && typeof value.nonce === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  private storeChoice(kind: 'princess' | 'crystal-clear', game: GameProjection, uid: string, choice: StoredChoice): void {
    this.storage()?.setItem(storedChoiceKey(kind, game, uid), JSON.stringify(choice));
  }

  private async acquireLease(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks) return true;
    let markAcquired: (acquired: boolean) => void = () => {};
    const acquired = new Promise<boolean>((resolve) => { markAcquired = resolve; });
    const request = navigator.locks.request(
      `rebel-princess:bot-controller:${this.options.gameId}:${this.options.instanceId}`,
      { ifAvailable: true },
      (lock) => {
        markAcquired(Boolean(lock));
        if (!lock) return;
        return new Promise<void>((resolve) => { this.releaseLease = resolve; });
      }
    );
    this.leaseRequest = request.then(async (held) => { await held; });
    return acquired;
  }

  async start(): Promise<void> {
    if (this.client || this.stopped) return;
    this.update('starting', 'Creating isolated bot identity');
    try {
      if (!await this.acquireLease()) {
        this.update('waiting', 'Controlled by another tab');
        return;
      }
      this.client = await createIsolatedFirebaseClient(`rebel-princess-${this.options.instanceId}`, this.options.emulatorUid);
      const seatUid = this.options.seatUid ?? this.client.uid;
      this.state.uid = seatUid;
      this.update('joining', this.options.seatUid ? 'Recovering bot seat' : 'Joining the room');
      const game = await loadGame(this.client.database, this.options.gameId);
      const existingSeat = game.players.find((player) => player.uid === seatUid);
      if (this.options.seatUid) {
        if (!existingSeat || existingSeat.displayName !== this.options.displayName) throw new Error('The saved bot seat is unavailable');
        if (this.client.uid !== seatUid) {
          if (!this.options.claimSeat) throw new Error('The bot seat needs a new controller claim');
          await this.options.claimSeat(this.client.uid);
        }
      } else {
        if (game.hands) throw new Error('Bots may only join before cards are dealt');
        if (game.players.length >= 6 && !existingSeat) throw new Error('The room is full');
        await appendGameEvent(this.client.database, this.options.gameId, this.client.uid, 'player/joined', { displayName: this.options.displayName, bot: true });
      }
      this.unsubscribe = subscribeToGame(
        this.client.database,
        this.options.gameId,
        (projection) => {
          this.latestProjection = projection;
          void this.pump();
        },
        (error) => this.update('error', error.message)
      );
      this.update('waiting', 'Waiting for setup');
    } catch (error) {
      this.releaseLease?.();
      this.releaseLease = null;
      await this.leaseRequest?.catch(() => {});
      this.leaseRequest = null;
      this.update('error', error instanceof Error ? error.message : 'Bot could not join');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsubscribe();
    this.unsubscribe = () => {};
    const client = this.client;
    this.client = null;
    if (client) await client.dispose();
    this.releaseLease?.();
    this.releaseLease = null;
    await this.leaseRequest?.catch(() => {});
    this.leaseRequest = null;
    this.update('stopped', 'Bot stopped');
  }

  private async append(type: Parameters<typeof appendGameEvent>[3], payload: Parameters<typeof appendGameEvent>[4]): Promise<void> {
    if (!this.client) throw new Error('Bot identity is unavailable');
    await appendGameEvent(this.client.database, this.options.gameId, this.client.uid, type, payload);
  }

  private async revealChoices(game: GameProjection, uid: string): Promise<boolean> {
    const player = game.players.find((candidate) => candidate.uid === uid);
    if (!player) return false;
    this.princessChoice ??= this.readChoice('princess', game, uid);
    this.crystalChoice ??= this.readChoice('crystal-clear', game, uid);
    if (!game.hands && !player.ready && game.princessCommitments[uid] && this.princessChoice && game.players.every((candidate) => game.princessCommitments[candidate.uid])) {
      this.update('choosing', 'Revealing sealed Princess');
      await this.append('player/configured', {
        princessId: this.princessChoice.choice,
        nonce: this.princessChoice.nonce,
        ready: true
      });
      return true;
    }
    if (game.awaitingRoundAction === 'reveal-suit' && game.suitCommitments[uid] && !game.revealedSuits[uid] && this.crystalChoice && game.players.every((candidate) => game.suitCommitments[candidate.uid])) {
      this.update('choosing', 'Revealing Crystal Clear suit');
      await this.append('round/suit-revealed', {
        suit: this.crystalChoice.choice as 'fairies' | 'queens' | 'princes' | 'pets',
        nonce: this.crystalChoice.nonce
      });
      return true;
    }
    return false;
  }

  private async pump(): Promise<void> {
    if (this.stopped || this.processing || !this.client) return;
    this.processing = true;
    try {
      while (this.latestProjection && !this.stopped) {
        const game = this.latestProjection;
        this.latestProjection = null;
        const uid = this.options.seatUid ?? this.client.uid;
        if (!game.players.some((player) => player.uid === uid)) continue;
        if (await this.revealChoices(game, uid)) continue;
        const observation = buildBotObservation(game, uid);
        let actions = policyBotActions(this.policy, observation, legalBotActions(game, uid));
        // Freeze the roster before bots commit. The human host signals that setup
        // is final by sealing a choice; a six-seat room is necessarily final.
        if (!game.hands && Object.keys(game.princessCommitments).length === 0 && game.players.length < 6) actions = [];
        if (!actions.length) {
          this.update('waiting', game.roundComplete ? 'Waiting for the host to deal' : 'Waiting for another player');
          continue;
        }
        const key = botDecisionKey(game, uid, actions);
        if (key === this.lastDecisionKey) continue;
        this.lastDecisionKey = key;
        const random = createSeededRandom(`${game.gameId}:${uid}:${key}`);
        const decision = await this.policy.choose(observation, actions, random);
        const action = actions[decision.actionIndex];
        if (!action) throw new Error(`Policy ${this.policy.id} chose an invalid action`);
        this.update('acting', action.type);
        if (action.type === 'choose-princess') {
          const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
          this.princessChoice = { choice: action.princessId, nonce };
          this.storeChoice('princess', game, uid, this.princessChoice);
          await this.append('player/princess-committed', {
            commitment: choiceCommitment(princessChoiceScope(game.gameId, game.gameNumber, uid), action.princessId, nonce)
          });
        } else if (action.type === 'choose-crystal-clear-suit') {
          const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
          this.crystalChoice = { choice: action.suit, nonce };
          this.storeChoice('crystal-clear', game, uid, this.crystalChoice);
          await this.append('round/suit-committed', {
            commitment: choiceCommitment(crystalClearChoiceScope(game.gameId, game.gameNumber, game.roundIndex, uid), action.suit, nonce)
          });
        } else {
          const intent = botActionToEvent(action);
          await this.append(intent.type, intent.payload);
        }
        this.update('waiting', 'Decision submitted');
      }
    } catch (error) {
      this.lastDecisionKey = '';
      this.update('error', error instanceof Error ? error.message : 'Bot decision failed');
    } finally {
      this.processing = false;
    }
  }
}
