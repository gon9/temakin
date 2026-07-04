import { screen, $, esc, toast, cloneCanvas } from '../dom';
import { store, newPlayerId, resetTournament } from '../store';
import { captureFromCamera } from '../../vision/camera';
import { cropFaceCircle } from '../../vision/faceCard';
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

export function showPlayers(): void {
  const root = screen(`
    <div class="page">
      <h2>プレイヤー登録</h2>
      <p class="hint">2〜${MAX_PLAYERS}人まで。顔を撮ると「顔ネタ」としてファイターに合成されるよ。</p>
      <ul class="player-list"></ul>
      <div class="add-form">
        <input type="text" class="name-input" maxlength="8" placeholder="なまえ（8文字まで）" enterkeyhint="done" />
        <div class="row">
          <button class="btn primary" data-act="add-face">🤳 顔ネタつきで追加</button>
          <button class="btn ghost" data-act="add-plain">顔なしで追加</button>
        </div>
      </div>
      <button class="btn primary big" data-act="go" disabled>トーナメント開始！</button>
    </div>
  `);

  const list = $(root, '.player-list');
  const input = $<HTMLInputElement>(root, '.name-input');
  const goBtn = $<HTMLButtonElement>(root, '[data-act="go"]');

  const renderList = () => {
    list.innerHTML = '';
    for (const p of store.players) {
      const li = document.createElement('li');
      li.className = 'player-item';
      li.innerHTML = `
        <span class="player-thumb">🍣</span>
        <span class="player-name">${esc(p.name)}</span>
        <button class="btn tiny ghost" data-remove="${p.id}">✕</button>
      `;
      if (p.face) {
        const thumb = cloneCanvas(p.face);
        thumb.className = 'player-face-thumb';
        li.querySelector('.player-thumb')!.replaceWith(thumb);
      }
      li.querySelector<HTMLButtonElement>(`[data-remove="${p.id}"]`)!.onclick = () => {
        store.players = store.players.filter((x) => x.id !== p.id);
        renderList();
      };
      list.appendChild(li);
    }
    goBtn.disabled = store.players.length < 2;
    goBtn.textContent =
      store.players.length < 2
        ? `トーナメント開始！（あと${2 - store.players.length}人）`
        : `トーナメント開始！（${store.players.length}人）`;
  };

  const takeName = (): string | null => {
    const name = input.value.trim();
    if (!name) {
      toast('なまえを入れてね');
      input.focus();
      return null;
    }
    if (store.players.length >= MAX_PLAYERS) {
      toast(`最大${MAX_PLAYERS}人までだよ`);
      return null;
    }
    if (store.players.some((p) => p.name === name)) {
      toast('同じなまえの人がいるよ');
      return null;
    }
    return name;
  };

  const addPlayer = (name: string, face: HTMLCanvasElement | null) => {
    store.players.push({ id: newPlayerId(), name, face, wins: 0 });
    input.value = '';
    renderList();
  };

  $(root, '[data-act="add-plain"]').onclick = () => {
    const name = takeName();
    if (name) addPlayer(name, null);
  };

  $(root, '[data-act="add-face"]').onclick = async () => {
    const name = takeName();
    if (!name) return;
    const shot = await captureFromCamera({
      facing: 'user',
      guide: 'circle',
      title: `${name}の顔ネタを撮影`,
      note: '丸の中に顔を収めてね',
    });
    addPlayer(name, shot ? cropFaceCircle(shot) : null);
    if (!shot) toast('顔なしで追加したよ');
  };

  goBtn.onclick = () => startTournament();

  renderList();
}
