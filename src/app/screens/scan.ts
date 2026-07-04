import { screen, $, esc, toast } from '../dom';
import { store, playerById } from '../store';
import { captureFromCamera } from '../../vision/camera';
import { analyzeTemakiCanvas, type AnalysisResult } from '../../vision/analyze';
import { generateSampleTemaki } from '../../vision/synthetic';
import { createFighter } from '../../game/fighterFactory';
import { showReveal } from './reveal';

/** これ未満しか手巻きが写っていなければ撮り直しを促す */
const MIN_AREA_RATIO = 0.04;

export function showScan(match: { a: string; b: string }): void {
  store.fighters.clear();
  scanPlayer(match.a, () => {
    scanPlayer(match.b, () => showReveal(match));
  });
}

function scanPlayer(playerId: string, onDone: () => void): void {
  const player = playerById(playerId);

  const root = screen(`
    <div class="page center">
      <h2>📷 ${esc(player.name)}の番！</h2>
      <p class="hint">作った手巻きを、<b>手巻きと違う色のお皿やテーブル</b>の上に置いて、明るい場所で枠いっぱいに撮ってね。</p>
      <div class="scan-preview hidden">
        <div class="scan-cutout"></div>
        <p class="warn">⚠️ 出撃させたら撮り直しはできないよ！</p>
        <div class="row">
          <button class="btn ghost" data-act="retake">撮り直す</button>
          <button class="btn primary" data-act="confirm">これで出撃！</button>
        </div>
      </div>
      <div class="scan-actions">
        <button class="btn primary big" data-act="camera">📷 手巻きをスキャン</button>
        <button class="btn ghost" data-act="sample">🎲 サンプル手巻きで試す（カメラ不要）</button>
      </div>
    </div>
  `);

  const previewBox = $(root, '.scan-preview');
  const actionsBox = $(root, '.scan-actions');
  let pending: AnalysisResult | null = null;

  const showConfirm = (result: AnalysisResult) => {
    pending = result;
    const holder = $(root, '.scan-cutout');
    result.cutout.className = 'scan-cutout-img';
    holder.replaceChildren(result.cutout);
    previewBox.classList.remove('hidden');
    actionsBox.classList.add('hidden');
  };

  const analyze = (source: HTMLCanvasElement) => {
    const result = analyzeTemakiCanvas(source);
    if (result.features.areaRatio < MIN_AREA_RATIO) {
      toast('手巻きをうまく見つけられなかった…もっと寄って、背景と違う色の上で撮ってね', true);
      return;
    }
    showConfirm(result);
  };

  $(root, '[data-act="camera"]').onclick = async () => {
    const shot = await captureFromCamera({
      facing: 'environment',
      guide: 'box',
      title: `${player.name}の手巻きをスキャン`,
      note: '枠の中に手巻きを収めてね',
    });
    if (shot) analyze(shot);
  };

  $(root, '[data-act="sample"]').onclick = () => {
    analyze(generateSampleTemaki());
  };

  $(root, '[data-act="retake"]').onclick = () => {
    pending = null;
    previewBox.classList.add('hidden');
    actionsBox.classList.remove('hidden');
  };

  $(root, '[data-act="confirm"]').onclick = () => {
    if (!pending) return;
    const fighter = createFighter(playerId, player.name, pending.features);
    store.fighters.set(playerId, { fighter, image: pending.cutout });
    onDone();
  };
}
