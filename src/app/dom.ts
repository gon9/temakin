export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** #app を差し替えて要素を返す */
export function screen(html: string): HTMLElement {
  const app = document.getElementById('app')!;
  app.innerHTML = html;
  app.scrollTop = 0;
  return app;
}

export function $<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`element not found: ${sel}`);
  return el;
}

let toastTimer: number | undefined;
export function toast(msg: string, isError = false): void {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.className = isError ? 'show error' : 'show';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.className = '';
  }, 3500);
}

/** 同じcanvasを複数箇所に表示できるよう複製する（DOMノードは一箇所にしか置けないため） */
export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}
