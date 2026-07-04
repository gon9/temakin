import { screen, $ } from '../dom';
import { showPlayers } from './players';

export function showTitle(): void {
  const root = screen(`
    <div class="hero">
      <p class="hero-sub">きみの手巻きが、たたかう。</p>
      <h1 class="hero-logo">🍣<br>手巻き<br>ファイター</h1>
      <ol class="hero-rules">
        <li>🍙 手巻き寿司を<b>作る</b></li>
        <li>📷 カメラで<b>スキャン</b>してファイター召喚</li>
        <li>⚔️ オートバトルで<b>対決</b></li>
        <li>😋 勝っても負けても<b>食べる</b>！</li>
      </ol>
      <button class="btn primary big" data-act="start">あそぶ</button>
      <p class="privacy-note">撮影した写真はこのスマホの中だけで処理され、どこにも送信されません。</p>
    </div>
  `);
  $(root, '[data-act="start"]').onclick = () => showPlayers();
}
