import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/game/statFormula';
import type { TemakiFeatures } from '../src/game/types';

const base: TemakiFeatures = {
  areaRatio: 0,
  redness: 0,
  brightness: 0,
  glossiness: 0,
  contourRuggedness: 0,
  saturationVariance: 0,
  colorClusters: [],
};

describe('computeStats', () => {
  it('最小特徴量で下限に張り付く', () => {
    const s = computeStats(base);
    expect(s).toEqual({ hp: 100, attack: 10, defense: 30, speed: 10, luck: 0 });
  });

  it('最大特徴量で上限に張り付く', () => {
    const s = computeStats({
      ...base,
      areaRatio: 1,
      redness: 1,
      brightness: 1,
      glossiness: 1,
      contourRuggedness: 1,
      saturationVariance: 1,
    });
    expect(s).toEqual({ hp: 300, attack: 50, defense: 0, speed: 50, luck: 20 });
  });

  it('決定的（同じ入力で同じ出力）', () => {
    const f = { ...base, areaRatio: 0.3, redness: 0.4, contourRuggedness: 0.5 };
    expect(computeStats(f)).toEqual(computeStats(f));
  });

  it('はみ出しは攻防のトレードオフになる', () => {
    const neat = computeStats({ ...base, contourRuggedness: 0.1 });
    const wild = computeStats({ ...base, contourRuggedness: 0.9 });
    expect(wild.attack).toBeGreaterThan(neat.attack);
    expect(wild.defense).toBeLessThan(neat.defense);
  });
});
