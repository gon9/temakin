import { describe, it, expect } from 'vitest';
import { segment, extractFeatures, type ImageDataLike } from '../src/vision/features';
import { mulberry32 } from '../src/game/prng';

const SIZE = 160;
const BG: [number, number, number] = [200, 190, 170]; // 明るいテーブル色

function blankImage(color: [number, number, number] = BG): ImageDataLike {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
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

  it('白い皿×白いシャリ×暗い海苔（実戦の難パターン）を検出できる', () => {
    // 暗いテーブルの上に白い皿、皿の上に海苔＋粒感のあるシャリ
    const img = blankImage([90, 60, 40]);
    paint(img, disk(76), [235, 232, 225]); // 白い皿（外周リングに皿とテーブルが混在する）
    paint(img, (x, y) => x >= 55 && x <= 110 && y >= 55 && y <= 110, [30, 34, 26]); // 海苔
    // シャリ: 皿とほぼ同じ白だが、米粒の影でテクスチャがある
    const rnd = mulberry32(7);
    const rice = (x: number, y: number) => (x - 80) ** 2 + (y - 108) ** 2 <= 26 * 26;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!rice(x, y)) continue;
        const v = rnd() < 0.25 ? 175 : 236;
        const i = y * SIZE + x;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v - 6;
      }
    }
    const seg = segment(img);
    const at = (x: number, y: number) => seg.mask[y * SIZE + x];
    // 海苔の中心は前景
    expect(at(80, 70)).toBe(1);
    // シャリ領域の大半が前景（テクスチャ救済）
    let riceHit = 0, riceTotal = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!rice(x, y)) continue;
        riceTotal++;
        riceHit += at(x, y);
      }
    }
    expect(riceHit / riceTotal).toBeGreaterThan(0.6);
    // なめらかな皿の部分（手巻きから離れた場所）は背景のまま
    expect(at(80, 20)).toBe(0);
    expect(at(20, 80)).toBe(0);
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
