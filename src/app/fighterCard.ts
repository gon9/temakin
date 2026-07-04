import type { FighterEntry, PlayerEntry } from './store';
import { esc, cloneCanvas } from './dom';
import { ELEMENT_LABEL } from '../game/data/moves';

/** ステータスバーの表示上の最大値（statFormulaの上限に対応） */
const STAT_MAX = { hp: 300, attack: 50, defense: 30, speed: 50, luck: 20 } as const;
const STAT_LABEL = { hp: 'HP', attack: 'こうげき', defense: 'ぼうぎょ', speed: 'すばやさ', luck: 'うん' } as const;

export function fighterCardElement(entry: FighterEntry, player: PlayerEntry): HTMLElement {
  const { fighter } = entry;
  const card = document.createElement('div');
  card.className = 'fighter-card';

  const statsHtml = (Object.keys(STAT_MAX) as (keyof typeof STAT_MAX)[])
    .map((key) => {
      const value = fighter.stats[key];
      const pct = Math.min(100, Math.round((value / STAT_MAX[key]) * 100));
      return `
        <div class="stat-row">
          <span class="stat-label">${STAT_LABEL[key]}</span>
          <span class="stat-value">${value}</span>
          <div class="stat-bar"><div class="stat-fill ${key}" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join('');

  const movesHtml = fighter.moves
    .map((m) => `<li><b>${esc(m.name)}</b> <small>威力${m.power} / ${ELEMENT_LABEL[m.element]}</small></li>`)
    .join('');

  card.innerHTML = `
    <div class="fighter-visual"></div>
    <p class="fighter-title">${esc(fighter.title)}</p>
    <p class="fighter-name">${esc(player.name)}</p>
    <div class="fighter-stats">${statsHtml}</div>
    <ul class="fighter-moves">${movesHtml}</ul>
  `;

  const visual = card.querySelector<HTMLElement>('.fighter-visual')!;
  const img = cloneCanvas(entry.image);
  img.className = 'fighter-photo';
  visual.appendChild(img);
  if (player.face) {
    const face = cloneCanvas(player.face);
    face.className = 'fighter-face';
    visual.appendChild(face);
  }
  return card;
}
