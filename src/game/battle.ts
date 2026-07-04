import type { BattleEvent, BattleLog, Fighter, Move } from './types';
import { mulberry32 } from './prng';

/** 20ラウンド(=最大40アクション)で決着しなければ判定 */
const MAX_ROUNDS = 20;

const CRIT_BASE = 0.05;
const CRIT_PER_LUCK = 0.005;
const DODGE_BASE = 0.03;
const DODGE_PER_LUCK = 0.004;

function pickMove(moves: Move[], rand: () => number): Move {
  const total = moves.reduce((s, m) => s + m.weight, 0);
  if (total <= 0) return moves[0];
  let r = rand() * total;
  for (const m of moves) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return moves[moves.length - 1];
}

/**
 * バトル全体を決定的に計算してログを返す。演出層はこのログを再生するだけ。
 * 同じファイター・同じシードなら常に同じ結果になる。
 */
export function runBattle(a: Fighter, b: Fighter, seed: number): BattleLog {
  const rand = mulberry32(seed);
  const fighters = [a, b] as const;
  const hp: [number, number] = [a.stats.hp, b.stats.hp];
  const maxHp: [number, number] = [a.stats.hp, b.stats.hp];
  const events: BattleEvent[] = [];

  // 素早い方が先攻。同速はコイントス
  let first: 0 | 1;
  if (a.stats.speed !== b.stats.speed) {
    first = a.stats.speed > b.stats.speed ? 0 : 1;
  } else {
    first = rand() < 0.5 ? 0 : 1;
  }

  let winner: 0 | 1 | null = null;
  let reason: 'ko' | 'judge' = 'ko';

  outer: for (let round = 0; round < MAX_ROUNDS; round++) {
    for (const attacker of [first, (1 - first) as 0 | 1]) {
      const defender = (1 - attacker) as 0 | 1;
      const atk = fighters[attacker].stats;
      const def = fighters[defender].stats;
      const move = pickMove(fighters[attacker].moves, rand);

      const dodge = DODGE_BASE + def.luck * DODGE_PER_LUCK;
      const hitChance = move.accuracy * (1 - dodge);
      let outcome: 'hit' | 'crit' | 'miss';
      let damage = 0;

      if (rand() < hitChance) {
        const crit = rand() < CRIT_BASE + atk.luck * CRIT_PER_LUCK;
        outcome = crit ? 'crit' : 'hit';
        const base = move.power * (atk.attack / (atk.attack + def.defense));
        damage = Math.max(1, Math.round(base * (0.85 + rand() * 0.3) * (crit ? 2 : 1)));
        hp[defender] = Math.max(0, hp[defender] - damage);
      } else {
        outcome = 'miss';
      }

      events.push({
        type: 'action',
        attacker,
        move,
        outcome,
        damage,
        hpAfter: [hp[0], hp[1]],
      });

      if (hp[defender] <= 0) {
        winner = attacker;
        break outer;
      }
    }
  }

  if (winner === null) {
    // 判定: 残りHP率が高い方。完全同率はコイントス
    const ratioA = hp[0] / maxHp[0];
    const ratioB = hp[1] / maxHp[1];
    reason = 'judge';
    if (ratioA !== ratioB) winner = ratioA > ratioB ? 0 : 1;
    else winner = rand() < 0.5 ? 0 : 1;
  }

  events.push({ type: 'end', winner, reason });
  return { events, winner, maxHp };
}
