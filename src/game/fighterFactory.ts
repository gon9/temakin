import type { ColorCluster, Fighter, Move, TemakiFeatures } from './types';
import { computeStats, clamp01 } from './statFormula';
import { MOVE_NAMES } from './data/moves';
import { TITLES } from './data/titles';

const MAX_MOVES = 4;

function buildMove(cluster: ColorCluster): Move {
  const occ = clamp01(cluster.occupancy);
  const tier = occ < 0.15 ? 0 : occ < 0.3 ? 1 : 2;
  return {
    name: MOVE_NAMES[cluster.element][tier],
    element: cluster.element,
    power: Math.round(40 + 80 * clamp01(occ * 1.6)),
    // ドカ盛りの技ほど強いが外れやすい
    accuracy: Math.round((0.95 - 0.2 * occ) * 100) / 100,
    weight: occ,
  };
}

function buildMoves(features: TemakiFeatures): Move[] {
  const clusters = [...features.colorClusters]
    .sort((a, b) => b.occupancy - a.occupancy)
    .slice(0, MAX_MOVES);
  if (clusters.length === 0) {
    // 特徴が取れなくても最低1つは技を持つ（海苔は必ずある）
    return [buildMove({ element: 'dark', occupancy: 0.2 })];
  }
  return clusters.map(buildMove);
}

function buildTitle(f: TemakiFeatures): string {
  // 各特徴を「突出度」として同じ土俵に正規化して最大を選ぶ
  const scores: [keyof typeof TITLES, number][] = [
    ['area', clamp01(f.areaRatio * 2.5)],
    ['redness', f.redness],
    ['rugged', f.contourRuggedness],
    ['neat', 1 - f.contourRuggedness],
    ['gloss', clamp01(f.glossiness * 5)],
    ['colorful', clamp01(f.colorClusters.length / 4)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [key, best] = scores[0];
  // どれも突出していなければバランス型
  if (best < 0.55) return TITLES.balanced;
  return TITLES[key];
}

export function createFighter(
  playerId: string,
  playerName: string,
  features: TemakiFeatures,
): Fighter {
  return {
    playerId,
    playerName,
    stats: computeStats(features),
    title: buildTitle(features),
    moves: buildMoves(features),
    features,
  };
}
