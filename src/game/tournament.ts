import { mulberry32 } from './prng';

export interface MatchResult {
  a: string;
  b: string;
  winner: string;
}

export interface Tournament {
  /** 今のラウンドの対戦順（ペアは前から2つずつ） */
  currentRound: string[];
  /** 次ラウンド進出者（不戦勝含む） */
  nextRound: string[];
  /** currentRound内の現在のペア先頭index */
  matchIndex: number;
  champion: string | null;
  history: MatchResult[];
}

function startRound(players: string[]): Pick<Tournament, 'currentRound' | 'nextRound' | 'matchIndex'> {
  const round = [...players];
  const byes: string[] = [];
  if (round.length % 2 === 1) {
    // 奇数人数は末尾（シャッフル済みなのでランダム相当）が不戦勝
    byes.push(round.pop()!);
  }
  return { currentRound: round, nextRound: byes, matchIndex: 0 };
}

export function createTournament(playerIds: string[], seed: number): Tournament {
  if (playerIds.length < 2) throw new Error('need at least 2 players');
  const rand = mulberry32(seed);
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.length === 2) {
    return { ...startRound(shuffled), champion: null, history: [] };
  }
  return { ...startRound(shuffled), champion: null, history: [] };
}

/** 現在の対戦カード。トーナメント終了後は null */
export function currentMatch(t: Tournament): { a: string; b: string } | null {
  if (t.champion) return null;
  return { a: t.currentRound[t.matchIndex], b: t.currentRound[t.matchIndex + 1] };
}

/** 勝者を報告して次の状態へ進める（元オブジェクトは変更しない） */
export function reportWinner(t: Tournament, winnerId: string): Tournament {
  const match = currentMatch(t);
  if (!match) throw new Error('tournament already finished');
  if (winnerId !== match.a && winnerId !== match.b) throw new Error('winner not in match');

  const history = [...t.history, { a: match.a, b: match.b, winner: winnerId }];
  const nextRound = [...t.nextRound, winnerId];
  const matchIndex = t.matchIndex + 2;

  if (matchIndex < t.currentRound.length) {
    return { ...t, matchIndex, nextRound, history };
  }
  // ラウンド終了
  if (nextRound.length === 1) {
    return { ...t, matchIndex, nextRound: [], champion: nextRound[0], history };
  }
  return { ...startRound(nextRound), champion: null, history };
}
