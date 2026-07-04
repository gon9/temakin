import type { BattleAction, BattleLog, Fighter } from '../game/types';
import { mulberry32 } from '../game/prng';

export interface RenderFighter {
  fighter: Fighter;
  image: HTMLCanvasElement;
  face: HTMLCanvasElement | null;
  name: string;
}

export interface PlayOptions {
  onFinish: () => void;
  /** 1 = 通常, 3 = 早送り。フレームごとに参照する */
  getSpeed: () => number;
}

const W = 720;
const H = 1000;
const INTRO_MS = 1600;
const ACTION_MS = 1500;
const END_MS = 2400;

interface Seg {
  kind: 'intro' | 'action' | 'end';
  dur: number;
  action?: BattleAction;
  hpBefore?: [number, number];
}

const OUTCOME_TEXT: Record<string, string> = {
  hit: '',
  crit: '会心の一撃！！',
  miss: 'しかし かわされた！',
};

/** バトルログをcanvasに再生する。戻り値は停止関数 */
export function playBattle(
  canvas: HTMLCanvasElement,
  log: BattleLog,
  fighters: [RenderFighter, RenderFighter],
  opts: PlayOptions,
): () => void {
  const ctx = canvas.getContext('2d')!;

  // タイムライン構築
  const segs: Seg[] = [{ kind: 'intro', dur: INTRO_MS }];
  let hp: [number, number] = [log.maxHp[0], log.maxHp[1]];
  for (const ev of log.events) {
    if (ev.type === 'action') {
      segs.push({ kind: 'action', dur: ACTION_MS, action: ev, hpBefore: [hp[0], hp[1]] });
      hp = ev.hpAfter;
    } else {
      segs.push({ kind: 'end', dur: END_MS, hpBefore: [hp[0], hp[1]] });
    }
  }

  // 紙吹雪（決定的に生成）
  const rnd = mulberry32(7);
  const confetti = Array.from({ length: 40 }, () => ({
    x: rnd() * W,
    y: -rnd() * H * 0.5,
    vy: 150 + rnd() * 250,
    color: ['#e0452c', '#f2c84b', '#4f9d3f', '#f5f0e6'][Math.floor(rnd() * 4)],
    size: 8 + rnd() * 10,
    phase: rnd() * Math.PI * 2,
  }));

  let elapsed = 0;
  let last = performance.now();
  let rafId = 0;
  let finished = false;
  let stopped = false;

  const spriteBox = 300;
  const baseY = 630;
  const baseX = [180, 540];

  const drawFighter = (idx: 0 | 1, dx: number, dy: number, scale = 1, alpha = 1) => {
    const f = fighters[idx];
    const img = f.image;
    const fit = Math.min(spriteBox / img.width, spriteBox / img.height) * scale;
    const w = img.width * fit;
    const h = img.height * fit;
    const x = baseX[idx] + dx;
    const y = baseY + dy;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (idx === 1) ctx.scale(-1, 1); // 右側は向かい合わせ
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    // 顔ネタバッジ
    if (f.face) {
      const r = 44;
      const fx = x + (idx === 0 ? -w / 2 : w / 2 - r) - (idx === 0 ? r * 0.2 : -r * 0.2);
      const fy = y - h / 2 - r * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(f.face, fx - r, fy - r, r * 2, r * 2);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#f5efe6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawHpBars = (cur: [number, number]) => {
    for (const idx of [0, 1] as const) {
      const x = idx === 0 ? 30 : W / 2 + 15;
      const y = 40;
      const barW = W / 2 - 45;
      const ratio = Math.max(0, cur[idx] / log.maxHp[idx]);
      ctx.fillStyle = '#f5efe6';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = idx === 0 ? 'left' : 'right';
      ctx.fillText(fighters[idx].name, idx === 0 ? x : x + barW, y);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y + 14, barW, 22);
      ctx.fillStyle = ratio > 0.5 ? '#5fbf5a' : ratio > 0.2 ? '#f2c84b' : '#e0452c';
      ctx.fillRect(x, y + 14, barW * ratio, 22);
      ctx.fillStyle = '#f5efe6';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(
        `${Math.round(cur[idx])}/${log.maxHp[idx]}`,
        idx === 0 ? x : x + barW,
        y + 58,
      );
    }
  };

  const drawCommentary = (line1: string, line2: string) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(24, H - 170, W - 48, 140);
    ctx.strokeStyle = 'rgba(245,239,230,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, H - 170, W - 48, 140);
    ctx.fillStyle = '#f5efe6';
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(line1, 48, H - 118, W - 96);
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillStyle = '#f2c84b';
    ctx.fillText(line2, 48, H - 62, W - 96);
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

  const draw = (seg: Seg, p: number) => {
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2118');
    g.addColorStop(1, '#17120d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(224,69,44,0.12)';
    ctx.beginPath();
    ctx.arc(W / 2, 560, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 760, W, 6);

    if (seg.kind === 'intro') {
      const slide = 1 - Math.min(1, p * 2);
      drawFighter(0, -slide * 400, 0);
      drawFighter(1, slide * 400, 0);
      drawHpBars([log.maxHp[0], log.maxHp[1]]);
      if (p > 0.45) {
        ctx.fillStyle = '#f5efe6';
        ctx.textAlign = 'center';
        ctx.font = 'bold 110px system-ui, sans-serif';
        ctx.fillText('VS', W / 2, 320);
      }
      drawCommentary(`${fighters[0].name} 「${fighters[0].fighter.title}」`, `${fighters[1].name} 「${fighters[1].fighter.title}」`);
      return;
    }

    if (seg.kind === 'action' && seg.action && seg.hpBefore) {
      const a = seg.action;
      const atkIdx = a.attacker;
      const defIdx = (1 - atkIdx) as 0 | 1;
      const dir = atkIdx === 0 ? 1 : -1;
      const hitMoment = 0.4;
      const isHit = a.outcome !== 'miss';

      // 突進
      const lungeP = Math.min(1, p / 0.7);
      const lunge = Math.sin(Math.PI * lungeP) * 160 * dir;

      // 被弾シェイク
      let shakeX = 0;
      let shakeY = 0;
      if (isHit && p >= hitMoment && p < hitMoment + 0.3) {
        const s = (1 - (p - hitMoment) / 0.3) * 14;
        shakeX = Math.sin(p * 120) * s;
        shakeY = Math.cos(p * 97) * s * 0.6;
      }

      if (atkIdx === 0) {
        drawFighter(0, lunge, 0);
        drawFighter(1, shakeX, shakeY);
      } else {
        drawFighter(0, shakeX, shakeY);
        drawFighter(1, lunge, 0);
      }

      // HPバー（ヒット後にじわっと減る）
      const hpNow: [number, number] = [seg.hpBefore[0], seg.hpBefore[1]];
      const t = (p - hitMoment) / 0.35;
      hpNow[defIdx] = lerp(seg.hpBefore[defIdx], a.hpAfter[defIdx], t);
      drawHpBars(hpNow);

      // ヒットフラッシュ
      if (isHit && p >= hitMoment && p < hitMoment + 0.12) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (p - hitMoment) / 0.12)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ダメージ数字
      if (p >= hitMoment) {
        const fp = (p - hitMoment) / 0.6;
        const dx = baseX[defIdx];
        const dy = baseY - 220 - fp * 90;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - fp);
        ctx.textAlign = 'center';
        if (a.outcome === 'miss') {
          ctx.font = 'bold 54px system-ui, sans-serif';
          ctx.fillStyle = '#9db4ff';
          ctx.fillText('MISS', dx, dy);
        } else {
          ctx.font = `bold ${a.outcome === 'crit' ? 84 : 60}px system-ui, sans-serif`;
          ctx.fillStyle = a.outcome === 'crit' ? '#ffb020' : '#ffffff';
          ctx.fillText(`${a.damage}`, dx, dy);
        }
        ctx.restore();
      }

      const line2 = p >= hitMoment ? OUTCOME_TEXT[a.outcome] : '';
      drawCommentary(`${fighters[atkIdx].name}の「${a.move.name}」！`, line2);
      return;
    }

    // end
    const winIdx = log.winner;
    const loseIdx = (1 - winIdx) as 0 | 1;
    const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * 40 * (1 - p * 0.5);
    drawFighter(winIdx, 0, -bounce, 1.05);
    drawFighter(loseIdx, 0, 40, 0.9, 0.35);
    drawHpBars(seg.hpBefore!);
    for (const c of confetti) {
      const cy = (c.y + c.vy * p * (END_MS / 1000)) % (H + 40);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x + Math.sin(c.phase + p * 8) * 20, cy, c.size, c.size * 0.6);
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillStyle = '#f2c84b';
    ctx.fillText(`🏆 ${fighters[winIdx].name}の勝ち！`, W / 2, 280);
  };

  const total = segs.reduce((s, x) => s + x.dur, 0);

  const frame = (now: number) => {
    if (stopped) return;
    elapsed += (now - last) * opts.getSpeed();
    last = now;

    let t = elapsed;
    let seg = segs[segs.length - 1];
    let p = 1;
    for (const s of segs) {
      if (t < s.dur) {
        seg = s;
        p = t / s.dur;
        break;
      }
      t -= s.dur;
    }

    draw(seg, p);

    if (elapsed >= total) {
      if (!finished) {
        finished = true;
        opts.onFinish();
      }
      return;
    }
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
