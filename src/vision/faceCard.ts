/** 正方形の自撮りcanvasを円形の「顔ネタカード」に切り抜く */
export function cropFaceCircle(square: HTMLCanvasElement, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(square, 0, 0, size, size);
  return c;
}
