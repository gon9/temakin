import { screen } from '../dom';
import { store, newPlayerId, resetTournament } from '../store';
import { createTournament } from '../../game/tournament';
import { hashString } from '../../game/prng';
import { showMatch } from './match';

const MAX_PLAYERS = 8;

export function startTournament(): void {
  resetTournament();
  store.tournament = createTournament(
    store.players.map((p) => p.id),
    hashString(`${Date.now()}:${store.matchCount}`),
  );
  showMatch();
}

/** 人数を選ぶだけの開始画面。名前入力・事前登録はしない */
export function showPlayers(): void {
  const buttons = Array.from(
    { length: MAX_PLAYERS - 1 },
    (_, i) => `<button class="btn primary count-btn" data-count="${i + 2}">${i + 2}人</button>`,
  ).join('');

  const root = screen(`
    <div class="page center">
      <h2>何人でたたかう？</h2>
      <p class="hint">登録は不要。「1P」「2P」…の順に手巻きをスキャンしていくよ。<br>顔ネタはスキャンのときに付けられる（任意）。</p>
      <div class="count-grid">${buttons}</div>
    </div>
  `);

  root.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((btn) => {
    btn.onclick = () => {
      const n = Number(btn.dataset.count);
      store.players = Array.from({ length: n }, (_, i) => ({
        id: newPlayerId(),
        name: `${i + 1}P`,
        face: null,
        wins: 0,
      }));
      store.matchCount = 0;
      startTournament();
    };
  });
}
