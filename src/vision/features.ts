import type { ColorCluster, Element, TemakiFeatures } from '../game/types';
import { clamp01 } from '../game/statFormula';

/** DOM非依存でテストできるように ImageData 互換の構造体を受け取る */
export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Segmentation {
  /** 1 = 手巻き領域 */
  mask: Uint8Array;
  width: number;
  height: number;
  areaRatio: number;
}

/** デジタル円の円形度(4πA/P²)の実測値。これを基準にはみ出し度を正規化する */
const CIRCULARITY_NORM = 0.62;
const MIN_CLUSTER_OCCUPANCY = 0.06;

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max / 255;
  return [h, s, v];
}

function erode(mask: Uint8Array, w: number, h: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w]) out[i] = 1;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, w: number, h: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (
        mask[i] ||
        (x > 0 && mask[i - 1]) ||
        (x < w - 1 && mask[i + 1]) ||
        (y > 0 && mask[i - w]) ||
        (y < h - 1 && mask[i + w])
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

/** value に一致する画素の連結成分をラベリングし、成分ごとの画素indexリストを返す */
function components(mask: Uint8Array, w: number, h: number, value: number): number[][] {
  const visited = new Uint8Array(mask.length);
  const result: number[][] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== value || visited[start]) continue;
    const comp: number[] = [];
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      comp.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0 && mask[i - 1] === value && !visited[i - 1]) { visited[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && mask[i + 1] === value && !visited[i + 1]) { visited[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && mask[i - w] === value && !visited[i - w]) { visited[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && mask[i + w] === value && !visited[i + w]) { visited[i + w] = 1; stack.push(i + w); }
    }
    result.push(comp);
  }
  return result;
}

/** 外周リングのk-meansクラスタ数（皿＋テーブル＋影などの複数背景に対応） */
const BG_CLUSTERS = 3;
/** リング画素のこれ未満しか占めないクラスタは背景とみなさない（隅のノイズ対策）。
 *  皿の縁がわずかにしか枠に入らないケースも背景として拾えるよう低めにしてある */
const BG_MIN_SHARE = 0.04;
/** 背景クラスタからのL1色距離がこれを超えたら前景 */
const COLOR_DIST_THRESHOLD = 60;
/** シャリ救済: 局所コントラストがこれを超える白っぽい画素は前景（米粒のテクスチャ） */
const RICE_STD_THRESHOLD = 0.045;

/** リング画素をRGBでk-meansし、背景色クラスタ（中心色の配列）を返す。決定的。 */
function ringClusters(data: Uint8ClampedArray, ringIdx: number[]): number[][] {
  const pixels = ringIdx.map((i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  // 決定的な初期化: 最暗・中央・最明。少数派でも極端に明るい/暗い背景
  // （例: 枠の縁にわずかに入った白い皿）が独立クラスタになるようにする
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centers = Array.from({ length: BG_CLUSTERS }, (_, k) => [
    ...sorted[Math.min(sorted.length - 1, Math.floor((k * (sorted.length - 1)) / (BG_CLUSTERS - 1)))],
  ]);
  const assign = new Uint8Array(pixels.length);
  for (let iter = 0; iter < 8; iter++) {
    for (let p = 0; p < pixels.length; p++) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const d =
          Math.abs(pixels[p][0] - centers[k][0]) +
          Math.abs(pixels[p][1] - centers[k][1]) +
          Math.abs(pixels[p][2] - centers[k][2]);
        if (d < bestD) { bestD = d; best = k; }
      }
      assign[p] = best;
    }
    centers = centers.map((c, k) => {
      let r = 0, g = 0, b = 0, cnt = 0;
      for (let p = 0; p < pixels.length; p++) {
        if (assign[p] !== k) continue;
        r += pixels[p][0]; g += pixels[p][1]; b += pixels[p][2]; cnt++;
      }
      return cnt > 0 ? [r / cnt, g / cnt, b / cnt] : c;
    });
  }
  const shares = centers.map((_, k) => {
    let cnt = 0;
    for (let p = 0; p < pixels.length; p++) if (assign[p] === k) cnt++;
    return cnt / pixels.length;
  });
  return centers.filter((_, k) => shares[k] >= BG_MIN_SHARE);
}

/**
 * ガイド枠内画像から手巻き領域を抽出する（DD 4.1）。
 * 1) 外周リングを複数クラスタで背景モデル化（白い皿＋暗いテーブル等の混在に対応）
 * 2) 背景色から遠い画素を前景に
 * 3) 白い皿の上の白いシャリは色では区別できないため、米粒のテクスチャ
 *    （局所コントラスト）で救済する
 * 4) 中央付近にかかる連結成分を採用（ガイドの中心に手巻きを置いてもらう前提）
 */
export function segment(img: ImageDataLike): Segmentation {
  const { width: w, height: h, data } = img;
  const n = w * h;

  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const ringIdx: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      ringIdx.push(y * w + x);
    }
  }
  const bg = ringClusters(data, ringIdx);

  // 輝度・彩度・明度と3x3局所標準偏差（シャリ判定用）
  const lum = new Float32Array(n);
  const sat = new Float32Array(n);
  const val = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    lum[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    val[i] = max / 255;
    sat[i] = max === 0 ? 0 : (max - min) / max;
  }

  let mask = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // 背景クラスタのどれからも遠ければ前景
      let minD = Infinity;
      for (const c of bg) {
        const d =
          Math.abs(data[i * 4] - c[0]) +
          Math.abs(data[i * 4 + 1] - c[1]) +
          Math.abs(data[i * 4 + 2] - c[2]);
        if (d < minD) minD = d;
      }
      if (minD > COLOR_DIST_THRESHOLD) {
        mask[i] = 1;
        continue;
      }
      // シャリ救済: 白っぽく、かつ米粒のテクスチャがある
      if (sat[i] < 0.35 && val[i] > 0.45 && x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        let s1 = 0, s2 = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = lum[i + dy * w + dx];
            s1 += v; s2 += v * v;
          }
        }
        const m = s1 / 9;
        if (Math.sqrt(Math.max(0, s2 / 9 - m * m)) > RICE_STD_THRESHOLD) mask[i] = 1;
      }
    }
  }

  // オープニング（収縮→膨張）でノイズ除去、さらに膨張1回で米粒同士をつなぐ
  mask = dilate(dilate(erode(mask, w, h), w, h), w, h);

  // 中央付近にかかる成分を採用（面積 × 中央率で選ぶ）
  const comps = components(mask, w, h, 1);
  mask = new Uint8Array(n);
  if (comps.length > 0) {
    const cx0 = w * 0.3, cx1 = w * 0.7, cy0 = h * 0.3, cy1 = h * 0.7;
    let best: number[] | null = null;
    let bestScore = -1;
    for (const comp of comps) {
      if (comp.length < n * 0.005) continue;
      let centerCnt = 0;
      for (const i of comp) {
        const x = i % w;
        const y = (i / w) | 0;
        if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) centerCnt++;
      }
      const score = comp.length * (0.2 + (centerCnt / comp.length) * 0.8);
      if (score > bestScore) { bestScore = score; best = comp; }
    }
    if (best) for (const i of best) mask[i] = 1;

    // 穴埋め: 外周に接しない背景成分は手巻き内部の穴とみなす
    const bgComps = components(mask, w, h, 0);
    for (const comp of bgComps) {
      let touchesBorder = false;
      for (const i of comp) {
        const x = i % w;
        const y = (i / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { touchesBorder = true; break; }
      }
      if (!touchesBorder) for (const i of comp) mask[i] = 1;
    }
  }

  let area = 0;
  for (let i = 0; i < n; i++) area += mask[i];
  return { mask, width: w, height: h, areaRatio: area / n };
}

function classifyElement(hue: number, s: number, v: number): Element {
  if (v < 0.28) return 'dark';
  if (s < 0.3) return v > 0.6 ? 'white' : 'dark';
  if (hue <= 32 || hue >= 340) return 'red';
  if (hue <= 75) return 'yellow';
  if (hue <= 180) return 'green';
  return 'dark';
}

/** マスク済み領域のピクセルから特徴量一式を計算する（DD 4.2） */
export function extractFeatures(img: ImageDataLike, seg: Segmentation): TemakiFeatures {
  const { width: w, height: h, data } = img;
  const { mask } = seg;

  let maskCount = 0;
  let redCount = 0;
  let glossCount = 0;
  let sumV = 0;
  let sumS = 0;
  let sumS2 = 0;
  const clusterCounts: Record<Element, number> = { red: 0, yellow: 0, green: 0, white: 0, dark: 0 };

  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    maskCount++;
    const [hue, s, v] = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    sumV += v;
    sumS += s;
    sumS2 += s * s;
    if ((hue <= 32 || hue >= 340) && s >= 0.35 && v >= 0.25) redCount++;
    if (v > 0.85 && s < 0.35) glossCount++;
    clusterCounts[classifyElement(hue, s, v)]++;
  }

  if (maskCount === 0) {
    return {
      areaRatio: 0,
      redness: 0,
      brightness: 0,
      glossiness: 0,
      contourRuggedness: 0,
      saturationVariance: 0,
      colorClusters: [],
    };
  }

  // 輪郭画素数から円形度を出し、円からのズレをはみ出し度とする
  let perimeter = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]
      ) {
        perimeter++;
      }
    }
  }
  const circularity = (4 * Math.PI * maskCount) / (perimeter * perimeter);
  const contourRuggedness = clamp01(1 - circularity / CIRCULARITY_NORM);

  const meanS = sumS / maskCount;
  const varS = Math.max(0, sumS2 / maskCount - meanS * meanS);
  const saturationVariance = clamp01(Math.sqrt(varS) / 0.3);

  const colorClusters: ColorCluster[] = (Object.keys(clusterCounts) as Element[])
    .map((element) => ({ element, occupancy: clusterCounts[element] / maskCount }))
    .filter((c) => c.occupancy >= MIN_CLUSTER_OCCUPANCY)
    .sort((a, b) => b.occupancy - a.occupancy);

  return {
    areaRatio: seg.areaRatio,
    redness: redCount / maskCount,
    brightness: sumV / maskCount,
    glossiness: glossCount / maskCount,
    contourRuggedness,
    saturationVariance,
    colorClusters,
  };
}
