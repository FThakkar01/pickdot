/**
 * Attention map.
 *
 * Spectral residual saliency (Hou & Zhang, CVPR 2007) on three opponent colour
 * channels, with a centre prior and a face prior (faces pull first fixations —
 * Cerf et al., NIPS 2007). Classical, deterministic, zero download.
 *
 * `SaliencyEngine` is the seam for a learned model: UNISAL (Apache-2.0) via
 * LiteRT.js can replace `spectralResidual` without touching anything else.
 */
import type { FaceInfo, Saliency, SaliencyRegion } from './types';

export const GRID = 64;

export interface SaliencyEngine {
  name: string;
  run(img: ImageData): Float32Array; // GRID × GRID, 0..1
}

// ---------- FFT ----------

function fft1(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function fft2(re: Float64Array, im: Float64Array, n: number, inverse: boolean) {
  const r = new Float64Array(n);
  const c = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      r[x] = re[y * n + x];
      c[x] = im[y * n + x];
    }
    fft1(r, c, inverse);
    for (let x = 0; x < n; x++) {
      re[y * n + x] = r[x];
      im[y * n + x] = c[x];
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      r[y] = re[y * n + x];
      c[y] = im[y * n + x];
    }
    fft1(r, c, inverse);
    for (let y = 0; y < n; y++) {
      re[y * n + x] = r[y];
      im[y * n + x] = c[y];
    }
  }
}

// ---------- helpers ----------

function gaussianBlur(src: Float32Array, n: number, sigma: number): Float32Array {
  const rad = Math.ceil(sigma * 3);
  const k: number[] = [];
  let ks = 0;
  for (let i = -rad; i <= rad; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ks += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(n * n);
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = -rad; i <= rad; i++) s += src[y * n + Math.min(n - 1, Math.max(0, x + i))] * k[i + rad];
      tmp[y * n + x] = s;
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = -rad; i <= rad; i++) s += tmp[Math.min(n - 1, Math.max(0, y + i)) * n + x] * k[i + rad];
      out[y * n + x] = s;
    }
  return out;
}

function normalise(m: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of m) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const out = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = (m[i] - lo) / span;
  return out;
}

/** Area-average resample of RGBA into an n×n grid of opponent channels. */
function opponentGrid(img: ImageData, n: number) {
  const { data, width: w, height: h } = img;
  const L = new Float64Array(n * n);
  const RG = new Float64Array(n * n);
  const BY = new Float64Array(n * n);
  const cnt = new Float64Array(n * n);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(n - 1, Math.floor((y / h) * n));
    for (let x = 0; x < w; x++) {
      const gx = Math.min(n - 1, Math.floor((x / w) * n));
      const p = (y * w + x) * 4;
      const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
      const i = gy * n + gx;
      L[i] += (r + g + b) / 3;
      RG[i] += r - g;
      BY[i] += b - (r + g) / 2;
      cnt[i]++;
    }
  }
  for (let i = 0; i < n * n; i++) {
    const c = cnt[i] || 1;
    L[i] /= c;
    RG[i] /= c;
    BY[i] /= c;
  }
  return [L, RG, BY];
}

function residualChannel(ch: Float64Array, n: number): Float32Array {
  const re = Float64Array.from(ch);
  const im = new Float64Array(n * n);
  fft2(re, im, n, false);
  const logA = new Float64Array(n * n);
  const phase = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) {
    logA[i] = Math.log(Math.hypot(re[i], im[i]) + 1e-9);
    phase[i] = Math.atan2(im[i], re[i]);
  }
  // Residual = log spectrum minus its 3×3 local average (wrap-around).
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) s += logA[((y + dy + n) % n) * n + ((x + dx + n) % n)];
      const res = logA[y * n + x] - s / 9;
      const e = Math.exp(res);
      re[y * n + x] = e * Math.cos(phase[y * n + x]);
      im[y * n + x] = e * Math.sin(phase[y * n + x]);
    }
  fft2(re, im, n, true);
  const out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = re[i] * re[i] + im[i] * im[i];
  return normalise(gaussianBlur(out, n, 2.5));
}

export const spectralResidual: SaliencyEngine = {
  name: 'Spectral residual + centre prior',
  run(img) {
    const n = GRID;
    const [L, RG, BY] = opponentGrid(img, n);
    const sL = residualChannel(L, n);
    const sRG = residualChannel(RG, n);
    const sBY = residualChannel(BY, n);
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const dx = (x + 0.5) / n - 0.5;
        const dy = (y + 0.5) / n - 0.5;
        const centre = Math.exp(-(dx * dx + dy * dy) / (2 * 0.28 * 0.28));
        out[i] = (0.5 * sL[i] + 0.25 * sRG[i] + 0.25 * sBY[i]) * (0.55 + 0.45 * centre);
      }
    return normalise(out);
  },
};

/** Faces are the strongest single predictor of where people look first. */
export function addFacePrior(map: Float32Array, faces: FaceInfo[]): Float32Array {
  if (!faces.length) return map;
  const n = GRID;
  const out = Float32Array.from(map);
  for (const f of faces) {
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h * 0.42; // eyes sit above the box centre
    const sx = Math.max(0.03, f.w * 0.45);
    const sy = Math.max(0.03, f.h * 0.45);
    const strength = 0.55 + Math.min(0.45, f.areaPct / 40);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = ((x + 0.5) / n - cx) / sx;
        const dy = ((y + 0.5) / n - cy) / sy;
        out[y * n + x] += strength * Math.exp(-(dx * dx + dy * dy) / 2);
      }
  }
  return normalise(out);
}

const REGION_THRESHOLD = 0.45;
const MIN_REGION_SHARE = 0.08;

/** Split the map into attention regions: connected blobs above threshold. */
export function describeSaliency(map: Float32Array): Saliency {
  const n = GRID;
  const label = new Int32Array(n * n).fill(-1);
  const regions: (SaliencyRegion & { mass: number })[] = [];
  let total = 0;
  let peak = 0;
  for (let i = 0; i < n * n; i++) {
    if (map[i] > map[peak]) peak = i;
    if (map[i] >= REGION_THRESHOLD) total += map[i];
  }
  const stack: number[] = [];
  for (let s = 0; s < n * n; s++) {
    if (label[s] !== -1 || map[s] < REGION_THRESHOLD) continue;
    const id = regions.length;
    let mass = 0;
    let x0 = n, y0 = n, x1 = 0, y1 = 0;
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % n;
      const y = (i / n) | 0;
      mass += map[i];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const j = ny * n + nx;
          if (label[j] === -1 && map[j] >= REGION_THRESHOLD) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
    regions.push({ x: x0 / n, y: y0 / n, w: (x1 - x0 + 1) / n, h: (y1 - y0 + 1) / n, share: 0, mass });
  }
  const kept = regions
    .map((r) => ({ ...r, share: total ? r.mass / total : 0 }))
    .filter((r) => r.share >= MIN_REGION_SHARE)
    .sort((a, b) => b.share - a.share)
    .map(({ mass: _m, ...r }) => r);
  return {
    size: n,
    map,
    regions: kept,
    regionCount: Math.max(1, kept.length),
    topShare: kept[0]?.share ?? 1,
    peak: { x: ((peak % n) + 0.5) / n, y: (((peak / n) | 0) + 0.5) / n },
  };
}
