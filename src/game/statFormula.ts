import type { FighterStats, TemakiFeatures } from './types';

/**
 * 特徴量→ステータスの変換係数。バランス調整はこのファイルだけで行う。
 * 設計意図（docs/design.md 5.1）:
 *  - はみ出す(ruggedness↑)と攻撃が伸びるが防御が下がる
 *  - デカく巻くとHPが伸びる
 *  - 全部盛り最強にならないトレードオフを保つ
 */
export const COEFF = {
  hpBase: 100,
  hpRange: 200,
  areaGain: 2.5,

  attackBase: 10,
  attackRange: 40,
  attackRedWeight: 0.7,
  attackRuggedWeight: 0.3,

  defenseRange: 30,

  speedBase: 10,
  speedRange: 40,
  speedGlossWeight: 0.5,
  speedBrightWeight: 0.5,
  /** glossinessは生値が小さい(0..0.2程度)ので増幅してから使う */
  glossGain: 5,

  luckRange: 20,
} as const;

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** 決定的な純関数。同じ特徴量からは常に同じステータスが出る */
export function computeStats(f: TemakiFeatures): FighterStats {
  const c = COEFF;
  const gloss = clamp01(f.glossiness * c.glossGain);
  return {
    hp: Math.round(c.hpBase + c.hpRange * clamp01(f.areaRatio * c.areaGain)),
    attack: Math.round(
      c.attackBase +
        c.attackRange *
          clamp01(c.attackRedWeight * f.redness + c.attackRuggedWeight * f.contourRuggedness),
    ),
    defense: Math.round(c.defenseRange * clamp01(1 - f.contourRuggedness)),
    speed: Math.round(
      c.speedBase +
        c.speedRange *
          clamp01(c.speedGlossWeight * gloss + c.speedBrightWeight * f.brightness),
    ),
    luck: Math.round(c.luckRange * clamp01(f.saturationVariance)),
  };
}
