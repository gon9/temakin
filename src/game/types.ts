/** 手巻きの色クラスタ属性。食材の色域にあわせた5属性 */
export type Element = 'red' | 'yellow' | 'green' | 'white' | 'dark';

export interface ColorCluster {
  element: Element;
  /** 手巻き領域に占める割合 0..1 */
  occupancy: number;
}

/** スキャン画像から抽出する生の特徴量。すべて 0..1 に正規化 */
export interface TemakiFeatures {
  areaRatio: number;
  redness: number;
  brightness: number;
  glossiness: number;
  contourRuggedness: number;
  saturationVariance: number;
  colorClusters: ColorCluster[];
}

export interface FighterStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
}

export interface Move {
  name: string;
  element: Element;
  power: number;
  /** 命中率 0..1 */
  accuracy: number;
  /** 技選択時の重み */
  weight: number;
}

export interface Fighter {
  playerId: string;
  playerName: string;
  stats: FighterStats;
  title: string;
  moves: Move[];
  features: TemakiFeatures;
}

export type ActionOutcome = 'hit' | 'crit' | 'miss';

export interface BattleAction {
  type: 'action';
  /** 0 = 先に渡されたファイター, 1 = 後 */
  attacker: 0 | 1;
  move: Move;
  outcome: ActionOutcome;
  damage: number;
  /** このアクション後の両者HP */
  hpAfter: [number, number];
}

export interface BattleEnd {
  type: 'end';
  winner: 0 | 1;
  reason: 'ko' | 'judge';
}

export type BattleEvent = BattleAction | BattleEnd;

export interface BattleLog {
  events: BattleEvent[];
  winner: 0 | 1;
  maxHp: [number, number];
}
