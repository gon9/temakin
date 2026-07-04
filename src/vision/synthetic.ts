/**
 * カメラなしで遊べる「サンプル手巻き」ジェネレータ。
 * 毎回ランダムな見た目の手巻きを描画するので、実物がなくても
 * ステータスガチャとバトルを体験できる（開発時の動作確認も兼ねる）。
 */

const TABLE = '#c9b795';
const INGREDIENTS = [
  '#d33b2f', // マグロ
  '#f0784a', // サーモン
  '#4f9d3f', // きゅうり
  '#f2c84b', // たまご
  '#8fbf5a', // アボカド
  '#e8542f', // いくら
  '#f5f0e6', // イカ
];

export function generateSampleTemaki(): HTMLCanvasElement {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  // 背景（テーブル）
  ctx.fillStyle = TABLE;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2, size / 2 + 20);
  ctx.rotate(rnd(-0.35, 0.35));

  const coneW = rnd(120, 190);
  const coneH = rnd(200, 300);

  // 海苔（コーン）
  ctx.fillStyle = '#20241c';
  ctx.beginPath();
  ctx.moveTo(0, coneH / 2);
  ctx.lineTo(-coneW / 2, -coneH / 2 + 40);
  ctx.quadraticCurveTo(0, -coneH / 2 - 10, coneW / 2, -coneH / 2 + 40);
  ctx.closePath();
  ctx.fill();

  // シャリ（開口部）
  ctx.fillStyle = '#f3ede1';
  ctx.beginPath();
  ctx.ellipse(0, -coneH / 2 + 42, coneW / 2 - 6, rnd(26, 42), 0, 0, Math.PI * 2);
  ctx.fill();

  // 具（開口部から飛び出すブロブ）
  const count = 2 + Math.floor(Math.random() * 4);
  for (let k = 0; k < count; k++) {
    const color = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
    ctx.fillStyle = color;
    const bx = rnd(-coneW / 3, coneW / 3);
    const by = -coneH / 2 + rnd(-40, 25);
    const rw = rnd(16, 42);
    const rh = rnd(30, 85);
    const rot = rnd(-0.9, 0.9);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // ツヤ
    if (Math.random() < 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-rw / 3, -rh / 3, rw / 4, rh / 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
  return c;
}
