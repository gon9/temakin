import { describe, it, expect } from 'vitest';
import { createTournament, currentMatch, reportWinner } from '../src/game/tournament';
import { mulberry32 } from '../src/game/prng';

describe('tournament', () => {
  for (let n = 2; n <= 8; n++) {
    it(`${n}人で必ず1人のチャンピオンが決まる`, () => {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const rand = mulberry32(n * 100);
      let t = createTournament(ids, 42 + n);
      let guard = 0;
      while (!t.champion) {
        const m = currentMatch(t);
        expect(m).not.toBeNull();
        expect(m!.a).not.toBe(m!.b);
        const winner = rand() < 0.5 ? m!.a : m!.b;
        t = reportWinner(t, winner);
        if (++guard > 50) throw new Error('tournament did not finish');
      }
      // シングルイリミネーションの試合数は常に n-1
      expect(t.history.length).toBe(n - 1);
      expect(ids).toContain(t.champion);
      // 一度負けた人は以降の試合に登場しない
      const eliminated = new Set<string>();
      for (const h of t.history) {
        expect(eliminated.has(h.a)).toBe(false);
        expect(eliminated.has(h.b)).toBe(false);
        eliminated.add(h.winner === h.a ? h.b : h.a);
      }
      expect(eliminated.has(t.champion!)).toBe(false);
    });
  }

  it('2人未満はエラー', () => {
    expect(() => createTournament(['a'], 1)).toThrow();
  });
});
