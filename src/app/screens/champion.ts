import { screen, $, esc, cloneCanvas } from '../dom';
import { store, playerById, resetTournament, resetAll } from '../store';
import { showTitle } from './title';
import { showPlayers, startTournament } from './players';

export function showChampion(): void {
  const t = store.tournament;
  if (!t?.champion) throw new Error('no champion yet');
  const champ = playerById(t.champion);

  const standings = [...store.players].sort((a, b) => b.wins - a.wins);
  const rows = standings
    .map(
      (p, i) => `
      <li class="standing ${p.id === champ.id ? 'first' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="standing-thumb" data-player="${p.id}">🍣</span>
        <span class="standing-name">${esc(p.name)}</span>
        <span class="standing-wins">${p.wins}勝</span>
      </li>`,
    )
    .join('');

  const root = screen(`
    <div class="page center">
      <p class="match-label">👑 本日の手巻き王</p>
      <h1 class="champion-name">${esc(champ.name)}</h1>
      <div class="champion-face-slot"></div>
      <ul class="standings">${rows}</ul>
      <div class="col">
        <button class="btn primary big" data-act="again">同じメンバーでもう一回</button>
        <button class="btn ghost" data-act="members">メンバーを変える</button>
        <button class="btn ghost" data-act="reset">さいしょから</button>
      </div>
    </div>
  `);

  if (champ.face) {
    const face = cloneCanvas(champ.face);
    face.className = 'champion-face';
    $(root, '.champion-face-slot').appendChild(face);
  }
  for (const p of store.players) {
    if (!p.face) continue;
    const thumb = cloneCanvas(p.face);
    thumb.className = 'player-face-thumb';
    root.querySelector(`[data-player="${p.id}"]`)?.replaceWith(thumb);
  }

  $(root, '[data-act="again"]').onclick = () => startTournament();
  $(root, '[data-act="members"]').onclick = () => {
    resetTournament();
    showPlayers();
  };
  $(root, '[data-act="reset"]').onclick = () => {
    resetAll();
    showTitle();
  };
}
