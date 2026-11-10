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
