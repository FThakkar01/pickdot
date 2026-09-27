import { useEffect, useRef, useState } from 'react';
import type { ImageAnalysis } from '../lib/types';

export type LensMode = 'dots' | 'heat' | 'overlay';

function sample(map: Float32Array, n: number, u: number, v: number): number {
  const x = Math.min(n - 1.001, Math.max(0, u * n - 0.5));
  const y = Math.min(n - 1.001, Math.max(0, v * n - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const a = map[y0 * n + x0], b = map[y0 * n + x0 + 1];
  const c = map[(y0 + 1) * n + x0], d = map[(y0 + 1) * n + x0 + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

// Dark → violet → pink → white, for the heat overlay.
const STOPS: [number, [number, number, number]][] = [
  [0, [20, 10, 30]],
  [0.35, [92, 44, 140]],
  [0.65, [237, 130, 214]],
  [0.85, [246, 212, 241]],
  [1, [255, 255, 255]],
];
function heat(v: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [p0, c0] = STOPS[i - 1];
      const [p1, c1] = STOPS[i];
      const t = (v - p0) / (p1 - p0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return [255, 255, 255];
}

function useImage(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

function useWidth(ref: React.RefObject<HTMLElement>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Lens({ a, mode, headlinePx }: { a: ImageAnalysis; mode: LensMode; headlinePx?: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(box);
  const img = useImage(a.url);
  const aspect = a.metrics.width / a.metrics.height;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = width;
    const H = Math.round(Math.min(W / aspect, W * 1.4));
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.height = `${H}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { map, size } = a.saliency;
    let raf = 0;

    // Fit the image inside W×H (contain) — maps are in image-normalised space.
    const fitW = Math.min(W, H * aspect);
    const fitH = fitW / aspect;
    const ox = (W - fitW) / 2;
    const oy = (H - fitH) / 2;

    if (mode === 'dots') {
      // Dot pitch from the longer side, so tall images keep legible dots.
      const pitch = Math.max(fitW, fitH) / (W < 300 ? 30 : 40);
      const cols = Math.max(8, Math.round(fitW / pitch));
      const rows = Math.max(8, Math.round(fitH / pitch));
      const step = fitW / cols;
      const stepY = fitH / rows;
      const start = performance.now();
      const dur = reduceMotion() ? 0 : 900;
      const frame = (now: number) => {
        ctx.clearRect(0, 0, W, H);
        const t = dur ? Math.min(1, (now - start) / dur) : 1;
        for (let x = 0; x < cols; x++) {
          const colT = Math.min(1, Math.max(0, t * 1.6 - (x / cols) * 0.6));
          const ease = 1 - Math.pow(1 - colT, 3);
          for (let y = 0; y < rows; y++) {
            const v = sample(map, size, (x + 0.5) / cols, (y + 0.5) / rows);
            const hot = v >= 0.45;
            const r = (Math.min(step, stepY) / 2) * (hot ? 0.55 + 0.4 * v : 0.42) * ease;
            if (r <= 0.2) continue;
            ctx.beginPath();
            ctx.fillStyle = hot ? `rgba(17,16,19,${0.6 + 0.4 * v})` : `rgba(17,16,19,${0.13 + v * 0.3})`;
            ctx.arc(ox + (x + 0.5) * step, oy + (y + 0.5) * stepY, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (t < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }

    ctx.fillStyle = '#0b0a0d';
    ctx.fillRect(0, 0, W, H);
    if (!img) return;

    if (mode === 'heat') {
      ctx.globalAlpha = 0.5;
      ctx.filter = 'grayscale(1)';
      ctx.drawImage(img, ox, oy, fitW, fitH);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      const off = document.createElement('canvas');
      const ow = 128, oh = Math.max(1, Math.round(128 / aspect));
      off.width = ow;
      off.height = oh;
      const octx = off.getContext('2d')!;
      const data = octx.createImageData(ow, oh);
      for (let y = 0; y < oh; y++)
        for (let x = 0; x < ow; x++) {
          const v = sample(map, size, (x + 0.5) / ow, (y + 0.5) / oh);
          const [r, g, b] = heat(v);
          const p = (y * ow + x) * 4;
          data.data[p] = r;
          data.data[p + 1] = g;
          data.data[p + 2] = b;
          data.data[p + 3] = Math.round(Math.pow(v, 1.4) * 235);
        }
      octx.putImageData(data, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, ox, oy, fitW, fitH);
      return;
    }

    // overlay: the image with what we measured drawn on top.
    ctx.drawImage(img, ox, oy, fitW, fitH);
    ctx.fillStyle = 'rgba(8,8,10,0.25)';
    ctx.fillRect(ox, oy, fitW, fitH);
    ctx.lineWidth = 1.5;
    ctx.font = '500 10px "Geist Mono", monospace';
    a.saliency.regions.forEach((r, i) => {
      const cx = ox + (r.x + r.w / 2) * fitW;
      const cy = oy + (r.y + r.h / 2) * fitH;
      const rad = Math.max(10, (Math.max(r.w * fitW, r.h * fitH) / 2) * 0.9);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${i + 1} · ${Math.round(r.share * 100)}%`, cx - rad * 0.7, cy - rad - 4);
    });
    const maxH = Math.max(0, ...a.textBoxes.map((b) => b.h));
    for (const b of a.textBoxes) {
      ctx.strokeStyle = '#edb8e6';
      ctx.strokeRect(ox + b.x * fitW, oy + b.y * fitH, b.w * fitW, b.h * fitH);
      if (b.h === maxH && headlinePx != null) {
        const label = `${Math.round(headlinePx)}px · ${b.contrast.toFixed(1)}:1`;
        const tx = ox + b.x * fitW;
        const ty = Math.max(12, oy + b.y * fitH - 5);
        ctx.fillStyle = '#edb8e6';
        ctx.fillRect(tx, ty - 11, ctx.measureText(label).width + 8, 14);
        ctx.fillStyle = '#111013';
        ctx.fillText(label, tx + 4, ty);
      }
    }
    for (const f of a.faces.list) {
      ctx.strokeStyle = '#b9d3ff';
      ctx.lineWidth = 2;
      const x = ox + f.x * fitW, y = oy + f.y * fitH, w = f.w * fitW, h = f.h * fitH;
      const k = Math.min(w, h) * 0.25;
      ctx.beginPath();
      for (const [px, py, dx, dy] of [
        [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
      ]) {
        ctx.moveTo(px + dx * k, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + dy * k);
      }
      ctx.stroke();
      const label = `face ${Math.round(f.areaPct)}%`;
      ctx.fillStyle = '#b9d3ff';
      ctx.fillRect(x, y + h + 3, ctx.measureText(label).width + 8, 14);
      ctx.fillStyle = '#111013';
      ctx.fillText(label, x + 4, y + h + 14);
    }
  }, [a, mode, width, img, aspect, headlinePx]);

  return (
    <div className="lens-box" ref={box}>
      <canvas ref={canvas} role="img" aria-label={`Attention map for image ${a.slot}`} />
    </div>
  );
}

/** Decorative dot matrix for empty upload slots — echoes the bar-of-dots motif. */
export function DotDecor({ seed = 1 }: { seed?: number }) {
  const cols = 22;
  const rows = 9;
  const heights = Array.from({ length: cols }, (_, i) => {
    const s = Math.sin(i * 1.7 + seed * 3.1) * 0.5 + 0.5;
    const ramp = i / cols;
    return Math.round((0.25 + 0.75 * (s * 0.55 + ramp * 0.45)) * rows);
  });
  return (
    <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" aria-hidden>
      {heights.map((h, x) =>
        Array.from({ length: rows }, (_, y) => {
          const on = rows - y <= h;
          return (
            <circle
              key={`${x}-${y}`}
              cx={x * 10 + 5}
              cy={y * 10 + 5}
              r={on ? 3.6 : 3}
              fill="currentColor"
              opacity={on ? (x > cols * 0.55 ? 0.95 : 0.22) : 0.06}
            />
          );
        }),
      )}
    </svg>
  );
}
