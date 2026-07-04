import type { Fighter } from '../game/types';
import type { Tournament } from '../game/tournament';

export interface PlayerEntry {
  id: string;
  name: string;
  /** 円形切り抜き済みの顔ネタ。未撮影なら null */
  face: HTMLCanvasElement | null;
  wins: number;
}

export interface FighterEntry {
  fighter: Fighter;
  /** 手巻きの透過切り抜き */
  image: HTMLCanvasElement;
}

export interface Store {
  players: PlayerEntry[];
  tournament: Tournament | null;
  /** 現在の対戦カードのファイター（playerId → entry） */
  fighters: Map<string, FighterEntry>;
  /** バトルのシードに混ぜる通し番号 */
  matchCount: number;
}

export const store: Store = {
  players: [],
  tournament: null,
  fighters: new Map(),
  matchCount: 0,
};

let idCounter = 0;
export function newPlayerId(): string {
  idCounter += 1;
  return `p${idCounter}-${Date.now().toString(36)}`;
}

export function playerById(id: string): PlayerEntry {
  const p = store.players.find((p) => p.id === id);
  if (!p) throw new Error(`unknown player: ${id}`);
  return p;
}

/** トーナメントだけリセット（メンバー継続でもう一回） */
export function resetTournament(): void {
  store.tournament = null;
  store.fighters.clear();
}

/** 全部リセット */
export function resetAll(): void {
  resetTournament();
  store.players = [];
  store.matchCount = 0;
}
