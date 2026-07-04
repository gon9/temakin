import { screen, $ } from '../dom';
import { store, playerById } from '../store';
import { runBattle } from '../../game/battle';
import { hashString } from '../../game/prng';
import { playBattle, type RenderFighter } from '../../render/battleRenderer';
import { showResult } from './result';

export function showBattle(match: { a: string; b: string }): void {
  const entryA = store.fighters.get(match.a)!;
  const entryB = store.fighters.get(match.b)!;

  const seed = hashString(`${match.a}|${match.b}|match#${store.matchCount}`);
  const log = runBattle(entryA.fighter, entryB.fighter, seed);

  const root = screen(`
    <div class="page battle-page">
      <canvas class="battle-canvas" width="720" height="1000"></canvas>
      <button class="btn ghost battle-skip" data-act="skip">⏩ はやおくり</button>
    </div>
  `);

  const canvas = $<HTMLCanvasElement>(root, '.battle-canvas');
  let speed = 1;
  const skipBtn = $<HTMLButtonElement>(root, '[data-act="skip"]');
  skipBtn.onclick = () => {
    speed = speed === 1 ? 3 : 1;
    skipBtn.textContent = speed === 1 ? '⏩ はやおくり' : '▶️ ふつうの速さ';
  };

  const toRender = (id: string): RenderFighter => {
    const entry = store.fighters.get(id)!;
    const player = playerById(id);
    return { fighter: entry.fighter, image: entry.image, face: player.face, name: player.name };
  };

  playBattle(canvas, log, [toRender(match.a), toRender(match.b)], {
    getSpeed: () => speed,
    onFinish: () => showResult(match, log),
  });
}
