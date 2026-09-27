/**
 * Text-line boxes, detect-only (we need positions and heights, not words).
 *
 * Classical pipeline: morphological gradient → Otsu → horizontal closing →
 * connected components → filters for text-like shape and stroke rhythm.
 * `ppu-paddle-ocr` detect() is the drop-in replacement when it earns its 6 MB.
 */
import { hex, relativeLuminance, wcagRatio } from './metrics';
import type { TextBox } from './types';

function otsu(values: Float32Array | number[], bins = 256): number {
  const hist = new Float64Array(bins);
  for (const v of values) hist[Math.min(bins - 1, Math.max(0, Math.floor(v * (bins - 1))))]++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = i;
    }
  }
  return (thr + 0.5) / (bins - 1);
}

function morphGradient(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let lo = 1, hi = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const v = gray[(y + dy) * w + x + dx];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      out[y * w + x] = hi - lo;
    }
  return out;
}

function closeHorizontal(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  const r = k >> 1;
  const dil = new Uint8Array(w * h);
  // Dilate: set if any pixel within r is set.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const pre = new Int32Array(w + 1);
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + mask[row + x];
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r), b = Math.min(w, x + r + 1);
      dil[row + x] = pre[b] - pre[a] > 0 ? 1 : 0;
    }
  }
  // Erode: keep only if every pixel within r is set.
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const pre = new Int32Array(w + 1);
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + dil[row + x];
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r), b = Math.min(w, x + r + 1);
      out[row + x] = pre[b] - pre[a] === b - a ? 1 : 0;
    }
  }
  return out;
}

export function detectText(img: ImageData, gray: Float32Array): TextBox[] {
  const { width: w, height: h, data } = img;
  const grad = morphGradient(gray, w, h);
  const thr = Math.max(0.14, otsu(grad));
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = grad[i] > thr ? 1 : 0;
  const closed = closeHorizontal(mask, w, h, Math.max(3, Math.round(w / 55)));

  // Connected components (4-connected).
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const boxes: TextBox[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!closed[s] || seen[s]) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [i - 1, i + 1, i - w, i + w];
      for (const j of nb) {
        if (j < 0 || j >= w * h) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        if (closed[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;

    // Shape: a line of text is wider than tall, not tiny, not most of the frame.
    // Near-square blobs are almost always image texture (food, faces, icons).
    if (bh < 6 || bh > h * 0.25 || bw < bh * 1.8 || bw > w * 0.98) continue;
    if (count / (bw * bh) < 0.4) continue;

    // Two tone clusters inside the box: glyphs vs ground.
    const vals: number[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) vals.push(gray[y * w + x]);
    const t = otsu(vals, 64);
    let nHi = 0, lumHi = 0, lumLo = 0;
    const cHi = [0, 0, 0], cLo = [0, 0, 0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x, p = i * 4;
        const L = relativeLuminance(data[p], data[p + 1], data[p + 2]);
        if (gray[i] > t) {
          nHi++; lumHi += L;
          cHi[0] += data[p]; cHi[1] += data[p + 1]; cHi[2] += data[p + 2];
        } else {
          lumLo += L;
          cLo[0] += data[p]; cLo[1] += data[p + 1]; cLo[2] += data[p + 2];
        }
      }
    const nLo = vals.length - nHi;
    if (!nHi || !nLo) continue;
    const hiIsFg = nHi < nLo; // glyphs are the minority
    const fgFrac = Math.min(nHi, nLo) / vals.length;
    if (fgFrac < 0.08 || fgFrac > 0.55) continue;

    // Stroke rhythm: glyphs flip the binary tone many times along a line.
    let flips = 0;
    for (const f of [0.35, 0.5, 0.65]) {
      const y = Math.round(y0 + f * (bh - 1));
      let prev = gray[y * w + x0] > t;
      for (let x = x0 + 1; x <= x1; x++) {
        const cur = gray[y * w + x] > t;
        if (cur !== prev) flips++;
        prev = cur;
      }
    }
    flips /= 3;
    // Glyphs flip ~2–5 times per box-height of width; noise and texture flip far more.
    const rhythm = flips / (bw / bh);
    if (flips < 4 || rhythm < 1.2 || rhythm > 7) continue;

    const contrast = wcagRatio(lumHi / nHi, lumLo / nLo);
    const [fg, bg] = hiIsFg ? [cHi, cLo] : [cLo, cHi];
    const [nf, nb] = hiIsFg ? [nHi, nLo] : [nLo, nHi];
    boxes.push({
      x: x0 / w,
      y: y0 / h,
      w: bw / w,
      h: bh / h,
      contrast,
      fg: hex(fg[0] / nf, fg[1] / nf, fg[2] / nf),
      bg: hex(bg[0] / nb, bg[1] / nb, bg[2] / nb),
    });
  }
  return boxes.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 12);
}
