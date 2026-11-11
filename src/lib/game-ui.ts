export type SpriteArtwork = {
  src: string;
  cols: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
  col: number;
  row: number;
  targetAspect?: number;
  style?: string;
};

export type GameArtwork =
  | { kind: 'image'; src: string; alt?: string }
  | { kind: 'sprite'; sprite: SpriteArtwork; alt?: string };

export type LobbyPlayer = {
  uid: string;
  displayName: string;
  host: boolean;
  ready: boolean;
  committed: boolean;
  princessName?: string;
  removable?: boolean;
};

export type LobbyPrincess = {
  id: string;
  name: string;
  power?: string;
  text: string;
  artwork: GameArtwork;
};

export type TableCard = {
  id: string;
  label: string;
  artwork: GameArtwork;
  rank: string | number;
  suit: string;
  badge?: string;
  badgeAlign?: 'left' | 'center';
  muted?: boolean;
  aspect?: number;
  accent?: string;
  frameBorderWidth?: string;
  framePadding?: string;
  elevated?: boolean;
};

export type HandCard = TableCard & {
  disabled?: boolean;
  selected?: boolean;
  committed?: boolean;
  playable?: boolean;
  contributable?: boolean;
  turnBlocked?: boolean;
  describedBy?: string;
};

export type SeatPrincess = {
  id?: string;
  name: string;
  power: string;
  artwork: GameArtwork;
  exhausted?: boolean;
  active?: boolean;
  armed?: boolean;
  pressed?: boolean;
  usable?: boolean;
  aspect?: number;
  status?: string;
};

export type ReviewCard = TableCard;

export type OpponentSeat = {
  uid: string;
  name: string;
  handCount: number;
  summary?: string;
  active?: boolean;
  complete?: boolean;
  actionLabel?: string;
  leader?: boolean;
  princess: SeatPrincess;
  capturedCount?: number;
  capturedCardCount?: number;
  lastCaptured?: ReviewCard[];
  revealedCards?: ReviewCard[];
  revealedLabel?: string;
  showCaptured?: boolean;
};

export type TrickPlay = TableCard & {
  playerName: string;
  faceDown?: boolean;
  originStyle?: string;
  collectStyle?: string;
};

export type TableRound = {
  name: string;
  rule: string;
  artwork: GameArtwork;
  current: number;
  total: number;
  passCount?: number;
  passDirection?: 'left' | 'right' | 'split' | 'none';
};

export type LocalSeat = {
  name: string;
  handCount: number;
  summary?: string;
  active?: boolean;
  complete?: boolean;
  actionLabel?: string;
  leader?: boolean;
  princess?: SeatPrincess;
  capturedCount?: number;
  capturedCardCount?: number;
  lastCaptured?: ReviewCard[];
  showCaptured?: boolean;
};
