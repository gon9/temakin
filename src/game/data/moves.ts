import type { Element } from '../types';

/**
 * 技名テーブル。色クラスタの占有率が高いほど後ろの技名が選ばれる。
 * [小さめ, ふつう, ドカ盛り] の3段階。
 */
export const MOVE_NAMES: Record<Element, [string, string, string]> = {
  red: ['赤身の一撃', 'マグロ大回転', '紅蓮のネタ神拳'],
  yellow: ['たまごビンタ', '黄金の玉子返し', 'オムレツ・インフェルノ'],
  green: ['きゅうりの盾突き', 'アボカド粘着弾', '大葉の疾風連斬'],
  white: ['シャリつぶて', '酢飯の吹雪', 'ライスサイクロン'],
  dark: ['海苔の切れ端', '海苔の暗黒包囲', 'ブラックロール・ゼロ'],
};

export const ELEMENT_LABEL: Record<Element, string> = {
  red: '赤ネタ',
  yellow: '黄ネタ',
  green: '緑ネタ',
  white: 'シャリ',
  dark: '海苔',
};
