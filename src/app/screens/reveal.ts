import { screen, $ } from '../dom';
import { store, playerById } from '../store';
import { fighterCardElement } from '../fighterCard';
import { showBattle } from './battle';

export function showReveal(match: { a: string; b: string }): void {
  const entryA = store.fighters.get(match.a);
  const entryB = store.fighters.get(match.b);
  if (!entryA || !entryB) throw new Error('fighters not scanned');

  const root = screen(`
    <div class="page">
      <h2 class="center-text">⚡ ファイター爆誕！</h2>
      <div class="reveal-cards">
        <div class="reveal-slot" data-slot="a"></div>
        <p class="vs-mark big">VS</p>
        <div class="reveal-slot" data-slot="b"></div>
      </div>
      <button class="btn primary big" data-act="battle">⚔️ バトル開始！</button>
    </div>
  `);

  $(root, '[data-slot="a"]').appendChild(fighterCardElement(entryA, playerById(match.a)));
  $(root, '[data-slot="b"]').appendChild(fighterCardElement(entryB, playerById(match.b)));
  $(root, '[data-act="battle"]').onclick = () => showBattle(match);
}
