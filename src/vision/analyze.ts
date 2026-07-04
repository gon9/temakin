import type { TemakiFeatures } from '../game/types';
import { segment, extractFeatures } from './features';

/** 特徴量計算に使う縮小解像度。精度と速度のバランス（16k画素） */
const ANALYSIS_SIZE = 160;
/** 切り抜きスプライトの最大辺 */
const CUTOUT_SIZE = 512;

export interface AnalysisResult {
  features: TemakiFeatures;
  /** 背景を透過にした手巻きスプライト（バウンディングボックスでトリム済み） */
  cutout: HTMLCanvasElement;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 2d context unavailable');
  return ctx;
}

/**
 * 撮影したガイド枠内画像を解析して、特徴量と透過切り抜きを返す。
 * areaRatio が極端に小さい場合は呼び出し側で撮り直しを促すこと。
 */
export function analyzeTemakiCanvas(source: HTMLCanvasElement): AnalysisResult {
  // 1) 縮小してセグメンテーション＋特徴量
  const small = makeCanvas(ANALYSIS_SIZE, ANALYSIS_SIZE);
  ctx2d(small).drawImage(source, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
  const imgData = ctx2d(small).getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
  const seg = segment(imgData);
  const features = extractFeatures(imgData, seg);

  // 2) マスクをアルファとして原寸相当に適用して切り抜き
  const maskCanvas = makeCanvas(ANALYSIS_SIZE, ANALYSIS_SIZE);
  const maskData = ctx2d(maskCanvas).createImageData(ANALYSIS_SIZE, ANALYSIS_SIZE);
  for (let i = 0; i < seg.mask.length; i++) {
    maskData.data[i * 4] = 255;
    maskData.data[i * 4 + 1] = 255;
    maskData.data[i * 4 + 2] = 255;
    maskData.data[i * 4 + 3] = seg.mask[i] ? 255 : 0;
  }
  ctx2d(maskCanvas).putImageData(maskData, 0, 0);

  const size = Math.min(CUTOUT_SIZE, Math.max(source.width, source.height));
  const full = makeCanvas(size, size);
  const fctx = ctx2d(full);
  fctx.drawImage(source, 0, 0, size, size);
  fctx.globalCompositeOperation = 'destination-in';
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(maskCanvas, 0, 0, size, size);
  fctx.globalCompositeOperation = 'source-over';

  // 3) マスクのバウンディングボックスでトリム（少し余白を残す）
  let minX = ANALYSIS_SIZE, minY = ANALYSIS_SIZE, maxX = -1, maxY = -1;
  for (let y = 0; y < ANALYSIS_SIZE; y++) {
    for (let x = 0; x < ANALYSIS_SIZE; x++) {
      if (!seg.mask[y * ANALYSIS_SIZE + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  let cutout = full;
  if (maxX >= 0) {
    const scale = size / ANALYSIS_SIZE;
    const pad = 4;
    const sx = Math.max(0, (minX - pad) * scale);
    const sy = Math.max(0, (minY - pad) * scale);
    const sw = Math.min(size - sx, (maxX - minX + 1 + pad * 2) * scale);
    const sh = Math.min(size - sy, (maxY - minY + 1 + pad * 2) * scale);
    cutout = makeCanvas(Math.round(sw), Math.round(sh));
    ctx2d(cutout).drawImage(full, sx, sy, sw, sh, 0, 0, cutout.width, cutout.height);
  }

  return { features, cutout };
}
