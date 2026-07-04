import { screen, $, esc, cloneCanvas } from '../dom';
import { store, playerById } from '../store';
import { currentMatch } from '../../game/tournament';
import { showScan } from './scan';
import { showChampion } from './champion';

function playerBadge(id: string): string {
  const p = playerById(id);
  return `
    <div class="vs-player" data-player="${p.id}">
      <span class="vs-thumb">🍣</span>
      <span class="vs-name">${esc(p.name)}</span>
    </div>`;
}

export function showMatch(): void {
  const t = store.tournament;
  if (!t) throw new Error('tournament not started');
  if (t.champion) {
    showChampion();
    return;
  }
  const match = currentMatch(t)!;
  const remaining = (t.currentRound.length - t.matchIndex) / 2;

  const root = screen(`
    <div class="page center">
      <p class="match-label">第${store.matchCount + 1}試合</p>
      <div class="vs-board">
        ${playerBadge(match.a)}
        <span class="vs-mark">VS</span>
        ${playerBadge(match.b)}
      </div>
      <p class="hint">このラウンド残り${remaining}試合${t.nextRound.length > 0 ? `・シード${t.nextRound.length}人` : ''}</p>
      <div class="maki-time">
        <h2>🍙 巻きタイム！</h2>
        <p>ふたりとも手巻き寿司を1本作ろう。<br>
        <b>デカ盛り</b>はHP、<b>赤いネタ</b>は攻撃、<b>キレイな巻き</b>は防御、<br>
        <b>ツヤ</b>は速さ、<b>具の種類</b>は技になるぞ。どう巻く？</p>
      </div>
      <button class="btn primary big" data-act="scan">できた！スキャンへ</button>
    </div>
  `);

  for (const id of [match.a, match.b]) {
    const p = playerById(id);
    if (p.face) {
      const thumb = cloneCanvas(p.face);
      thumb.className = 'vs-face-thumb';
      root.querySelector(`[data-player="${id}"] .vs-thumb`)!.replaceWith(thumb);
    }
  }

  $(root, '[data-act="scan"]').onclick = () => showScan(match);
}
