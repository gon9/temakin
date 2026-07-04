import { screen, $, esc } from '../dom';
import { store, playerById } from '../store';
import type { BattleLog } from '../../game/types';
import { reportWinner } from '../../game/tournament';
import { fighterCardElement } from '../fighterCard';
import { makeResultCard, shareCanvas } from '../../render/resultCard';
import { showMatch } from './match';
import { showChampion } from './champion';

export function showResult(match: { a: string; b: string }, log: BattleLog): void {
  const winnerId = log.winner === 0 ? match.a : match.b;
  const loserId = log.winner === 0 ? match.b : match.a;
  const winner = playerById(winnerId);
  const loser = playerById(loserId);
  const winnerEntry = store.fighters.get(winnerId)!;

  // 勝敗を確定させてトーナメントを進める（この画面に来た時点で1回だけ）
  winner.wins += 1;
  store.matchCount += 1;
  store.tournament = reportWinner(store.tournament!, winnerId);

  const judge = log.events[log.events.length - 1];
  const byJudge = judge.type === 'end' && judge.reason === 'judge';

  const root = screen(`
    <div class="page center">
      <p class="match-label">🏆 WINNER${byJudge ? '（判定勝ち）' : ''}</p>
      <h2 class="winner-name">${esc(winner.name)}</h2>
      <div class="result-card-slot"></div>
      <p class="hint">${esc(loser.name)}は残念！おいしく食べてリベンジだ🍣</p>
      <div class="row">
        <button class="btn ghost" data-act="share">🖼 画像でシェア</button>
        <button class="btn primary" data-act="next">つぎへ ▶</button>
      </div>
    </div>
  `);

  $(root, '.result-card-slot').appendChild(fighterCardElement(winnerEntry, winner));

  $(root, '[data-act="share"]').onclick = () => {
    const card = makeResultCard(
      { fighter: winnerEntry.fighter, image: winnerEntry.image, face: winner.face, name: winner.name },
      `第${store.matchCount}試合`,
    );
    void shareCanvas(card, `temaki-fighter-${store.matchCount}.png`);
  };

  $(root, '[data-act="next"]').onclick = () => {
    if (store.tournament!.champion) showChampion();
    else showMatch();
  };
}
