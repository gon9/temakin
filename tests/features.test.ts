import { describe, it, expect } from 'vitest';
import { segment, extractFeatures, type ImageDataLike } from '../src/vision/features';

const SIZE = 160;
const BG: [number, number, number] = [200, 190, 170]; // 明るいテーブル色

function blankImage(): ImageDataLike {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = BG[0];
    data[i * 4 + 1] = BG[1];
    data[i * 4 + 2] = BG[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: SIZE, height: SIZE };
}

function paint(img: ImageDataLike, inside: (x: number, y: number) => boolean, rgb: [number, number, number]) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inside(x, y)) continue;
      const i = y * SIZE + x;
      img.data[i * 4] = rgb[0];
      img.data[i * 4 + 1] = rgb[1];
      img.data[i * 4 + 2] = rgb[2];
    }
  }
}

const cx = SIZE / 2;
const cy = SIZE / 2;

const disk = (r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** ギザギザの星形（はみ出し形状の代用） */
const star = (rOuter: number, rInner: number, spikes: number) => (x: number, y: number) => {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const t = (Math.cos(angle * spikes) + 1) / 2;
  return d <= rInner + (rOuter - rInner) * t;
};

describe('segment', () => {
  it('背景と違う色の領域を正しい面積で抽出する', () => {
    const img = blankImage();
    const r = 40;
    paint(img, disk(r), [211, 59, 47]); // マグロ色
    const seg = segment(img);
    const expected = (Math.PI * r * r) / (SIZE * SIZE);
    expect(seg.areaRatio).toBeGreaterThan(expected * 0.8);
    expect(seg.areaRatio).toBeLessThan(expected * 1.2);
  });

  it('何も置いていなければ面積ほぼゼロ', () => {
    const seg = segment(blankImage());
    expect(seg.areaRatio).toBeLessThan(0.02);
  });
});

describe('extractFeatures', () => {
  it('赤い円は redness が高く、はみ出し度が低い', () => {
    const img = blankImage();
    paint(img, disk(45), [211, 59, 47]);
    const seg = segment(img);
    const f = extractFeatures(img, seg);
    expect(f.redness).toBeGreaterThan(0.7);
    expect(f.contourRuggedness).toBeLessThan(0.35);
    expect(f.colorClusters[0]?.element).toBe('red');
  });

  it('ギザギザ形状は円よりはみ出し度が高い', () => {
    const imgDisk = blankImage();
    paint(imgDisk, disk(45), [80, 120, 60]);
    const fDisk = extractFeatures(imgDisk, segment(imgDisk));

    const imgStar = blankImage();
    paint(imgStar, star(60, 22, 8), [80, 120, 60]);
    const fStar = extractFeatures(imgStar, segment(imgStar));

    expect(fStar.contourRuggedness).toBeGreaterThan(fDisk.contourRuggedness + 0.15);
  });

  it('暗い領域は dark クラスタ（海苔）になる', () => {
    const img = blankImage();
    paint(img, disk(45), [32, 36, 28]); // 海苔色
    const f = extractFeatures(img, segment(img));
    expect(f.colorClusters[0]?.element).toBe('dark');
  });

  it('複数の色を置くとクラスタが増える', () => {
    const img = blankImage();
    // 海苔の土台に赤・緑・黄のネタ
    paint(img, disk(50), [32, 36, 28]);
    paint(img, (x, y) => disk(20)(x, y - 25), [211, 59, 47]);
    paint(img, (x, y) => disk(14)(x + 28, y + 15), [79, 157, 63]);
    paint(img, (x, y) => disk(14)(x - 28, y + 15), [242, 200, 75]);
    const f = extractFeatures(img, segment(img));
    expect(f.colorClusters.length).toBeGreaterThanOrEqual(3);
  });
});
