/**
 * フルスクリーンのカメラ撮影UI。
 * 撮影→プレビュー→OK/撮り直し まで面倒を見て、確定した正方形canvasを返す。
 * キャンセル時は null。
 */
export interface CaptureOptions {
  facing: 'user' | 'environment';
  guide: 'circle' | 'box';
  title: string;
  note?: string;
}

const GUIDE_RATIO = 0.8;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function captureFromCamera(opts: CaptureOptions): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.innerHTML = `
      <div class="camera-head">
        <p class="camera-title">${esc(opts.title)}</p>
        ${opts.note ? `<p class="camera-note">${esc(opts.note)}</p>` : ''}
      </div>
      <div class="camera-stage">
        <video playsinline autoplay muted></video>
        <canvas class="camera-preview hidden"></canvas>
        <div class="camera-guide ${opts.guide}"></div>
      </div>
      <p class="camera-error hidden"></p>
      <div class="camera-actions">
        <button class="btn ghost" data-act="cancel">やめる</button>
        <button class="btn primary" data-act="shoot">📷 撮影</button>
        <button class="btn ghost hidden" data-act="retake">撮り直す</button>
        <button class="btn primary hidden" data-act="ok">これでいく！</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('video')!;
    const preview = overlay.querySelector<HTMLCanvasElement>('.camera-preview')!;
    const errorEl = overlay.querySelector<HTMLElement>('.camera-error')!;
    const btn = (act: string) => overlay.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

    let stream: MediaStream | null = null;
    let shot: HTMLCanvasElement | null = null;

    const cleanup = (result: HTMLCanvasElement | null) => {
      stream?.getTracks().forEach((t) => t.stop());
      overlay.remove();
      resolve(result);
    };

    const setMode = (mode: 'live' | 'preview') => {
      const live = mode === 'live';
      video.classList.toggle('hidden', !live);
      preview.classList.toggle('hidden', live);
      btn('shoot').classList.toggle('hidden', !live);
      btn('cancel').classList.toggle('hidden', !live);
      btn('retake').classList.toggle('hidden', live);
      btn('ok').classList.toggle('hidden', live);
    };

    btn('cancel').onclick = () => cleanup(null);
    btn('ok').onclick = () => cleanup(shot);
    btn('retake').onclick = () => {
      shot = null;
      setMode('live');
    };
    btn('shoot').onclick = () => {
      if (!video.videoWidth) return;
      // 画面のガイドとおおむね一致する、映像中央の正方形を切り出す
      const side = Math.round(Math.min(video.videoWidth, video.videoHeight) * GUIDE_RATIO);
      const sx = Math.round((video.videoWidth - side) / 2);
      const sy = Math.round((video.videoHeight - side) / 2);
      const c = document.createElement('canvas');
      const out = Math.min(side, 768);
      c.width = out;
      c.height = out;
      const ctx = c.getContext('2d')!;
      if (opts.facing === 'user') {
        // インカメは鏡像で保存する（見たままにする）
        ctx.translate(out, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
      shot = c;
      preview.width = out;
      preview.height = out;
      preview.getContext('2d')!.drawImage(c, 0, 0);
      setMode('preview');
    };

    if (opts.facing === 'user') video.classList.add('mirror');

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: opts.facing }, width: { ideal: 1280 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        video.srcObject = s;
      })
      .catch((err: unknown) => {
        const e = err as DOMException;
        errorEl.classList.remove('hidden');
        errorEl.textContent =
          e?.name === 'NotAllowedError'
            ? 'カメラが許可されていません。ブラウザのサイト設定でカメラを許可してください。'
            : `カメラを起動できませんでした (${e?.name ?? 'unknown'})`;
        btn('shoot').disabled = true;
      });
  });
}
