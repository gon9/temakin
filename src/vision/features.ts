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

/**
 * ガイド枠内画像から手巻き領域を抽出する。
 * 枠の外周を背景色サンプルとして、色距離で前景を分離する古典的手法（DD 4.1）。
 */
export function segment(img: ImageDataLike): Segmentation {
  const { width: w, height: h, data } = img;
  const n = w * h;

  // 外周リングから背景色の平均と平均偏差を推定
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  let mr = 0, mg = 0, mb = 0, count = 0;
  const ringIdx: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      const i = y * w + x;
      ringIdx.push(i);
      mr += data[i * 4];
      mg += data[i * 4 + 1];
      mb += data[i * 4 + 2];
      count++;
    }
  }
  mr /= count; mg /= count; mb /= count;
  let dev = 0;
  for (const i of ringIdx) {
    dev +=
      Math.abs(data[i * 4] - mr) +
      Math.abs(data[i * 4 + 1] - mg) +
      Math.abs(data[i * 4 + 2] - mb);
  }
  dev /= count;
  const threshold = Math.max(60, dev * 4);

  // 背景色からのL1距離で前景判定
  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dist =
      Math.abs(data[i * 4] - mr) +
      Math.abs(data[i * 4 + 1] - mg) +
      Math.abs(data[i * 4 + 2] - mb);
    if (dist > threshold) mask[i] = 1;
  }

  // オープニング（収縮→膨張）でノイズ除去
  mask = dilate(erode(mask, w, h), w, h);

  // 最大連結成分だけ残す
  const comps = components(mask, w, h, 1);
  mask = new Uint8Array(n);
  if (comps.length > 0) {
    comps.sort((a, b) => b.length - a.length);
    for (const i of comps[0]) mask[i] = 1;

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
