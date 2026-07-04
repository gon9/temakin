import type { RenderFighter } from './battleRenderer';

/** シェア用のリザルト画像（勝者カード）を生成する */
export function makeResultCard(winner: RenderFighter, matchLabel: string): HTMLCanvasElement {
  const W = 900;
  const H = 1200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a2118');
  g.addColorStop(1, '#17120d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(224,69,44,0.16)';
  ctx.beginPath();
  ctx.arc(W / 2, 560, 360, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c84b';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(`🏆 WINNER — ${matchLabel}`, W / 2, 110);

  // 手巻きスプライト
  const img = winner.image;
  const box = 520;
  const fit = Math.min(box / img.width, box / img.height);
  const iw = img.width * fit;
  const ih = img.height * fit;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  ctx.drawImage(img, W / 2 - iw / 2, 560 - ih / 2, iw, ih);
  ctx.shadowColor = 'transparent';

  // 顔ネタ
  if (winner.face) {
    const r = 90;
    const fx = W / 2 + iw / 2 - 20;
    const fy = 560 - ih / 2 + 10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(winner.face, fx - r, fy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = '#f5efe6';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#b8a88f';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(`「${winner.fighter.title}」`, W / 2, 920);
  ctx.fillStyle = '#f5efe6';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(winner.name, W / 2, 1010);

  const s = winner.fighter.stats;
  ctx.fillStyle = '#b8a88f';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText(`HP${s.hp} / こうげき${s.attack} / ぼうぎょ${s.defense} / すばやさ${s.speed}`, W / 2, 1080);

  ctx.fillStyle = '#e0452c';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('🍣 手巻きファイター', W / 2, 1150);

  return c;
}

/** Web Share APIでシェア。使えない環境ではダウンロードにフォールバック */
export async function shareCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '手巻きファイター' });
      return;
    } catch {
      // キャンセル時などはダウンロードに落とす
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
