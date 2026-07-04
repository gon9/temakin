import { describe, it, expect } from 'vitest';
import { runBattle } from '../src/game/battle';
import type { Fighter, FighterStats } from '../src/game/types';

function fighter(id: string, stats: FighterStats): Fighter {
  return {
    playerId: id,
    playerName: id,
    stats,
    title: 'テスト',
    moves: [
      { name: '技A', element: 'red', power: 70, accuracy: 0.9, weight: 0.5 },
      { name: '技B', element: 'dark', power: 50, accuracy: 0.95, weight: 0.3 },
    ],
    features: {
      areaRatio: 0.3,
      redness: 0.3,
      brightness: 0.5,
      glossiness: 0.1,
      contourRuggedness: 0.3,
      saturationVariance: 0.3,
      colorClusters: [],
    },
  };
}

const strong = () => fighter('strong', { hp: 260, attack: 45, defense: 22, speed: 40, luck: 10 });
const weak = () => fighter('weak', { hp: 130, attack: 18, defense: 8, speed: 20, luck: 5 });
const mid = () => fighter('mid', { hp: 200, attack: 30, defense: 15, speed: 30, luck: 10 });

describe('runBattle', () => {
  it('同じシードなら完全に同じログになる', () => {
    const a = runBattle(strong(), weak(), 12345);
    const b = runBattle(strong(), weak(), 12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('必ず決着し、最後はendイベント', () => {
    for (let seed = 0; seed < 50; seed++) {
      const log = runBattle(mid(), mid(), seed);
      const last = log.events[log.events.length - 1];
      expect(last.type).toBe('end');
      expect([0, 1]).toContain(log.winner);
    }
  });

  it('HPは負にならず、単調に減る', () => {
    const log = runBattle(strong(), weak(), 999);
    let prev: [number, number] = [260, 130];
    for (const ev of log.events) {
      if (ev.type !== 'action') continue;
      expect(ev.hpAfter[0]).toBeGreaterThanOrEqual(0);
      expect(ev.hpAfter[1]).toBeGreaterThanOrEqual(0);
      expect(ev.hpAfter[0]).toBeLessThanOrEqual(prev[0]);
      expect(ev.hpAfter[1]).toBeLessThanOrEqual(prev[1]);
      prev = ev.hpAfter;
    }
  });

  it('強い手巻きが大体勝つ（1000戦シミュレーション）', () => {
    let wins = 0;
    const n = 1000;
    for (let seed = 0; seed < n; seed++) {
      if (runBattle(strong(), weak(), seed).winner === 0) wins++;
    }
    const rate = wins / n;
    expect(rate).toBeGreaterThan(0.75);
  });

  it('番狂わせも起きる（強豪同士では一方的にならない）', () => {
    let wins = 0;
    const n = 1000;
    for (let seed = 0; seed < n; seed++) {
      if (runBattle(strong(), mid(), seed).winner === 0) wins++;
    }
    const rate = wins / n;
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(0.98);
  });
});
