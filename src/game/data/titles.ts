/**
 * 二つ名テーブル。最も突出した特徴で決まる。
 * key は fighterFactory の判定ロジックと対応。
 */
export const TITLES = {
  area: 'メガ盛りの巨人',
  redness: '紅の暴君',
  rugged: 'はみ出し狂戦士',
  neat: '鉄壁の海苔巻き',
  gloss: '光速のツヤ使い',
  colorful: '七色の欲張り職人',
  balanced: 'バランスの求道者',
} as const;

export type TitleKey = keyof typeof TITLES;
