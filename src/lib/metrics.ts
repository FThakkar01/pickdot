import type { CanvasMetrics } from './types';

// sRGB channel -> linear light, for WCAG relative luminance.
export const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b];
}

export function wcagRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function hex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Perceptual grey 0..1 (Rec. 601 luma), used for edges and structure. */
export function toGray(data: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    g[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  }
  return g;
}

/** 3×3 Sobel magnitude. Max possible value is ~5.66 on a 0..1 image. */
export function sobel(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1], t = gray[i - w], tr = gray[i - w + 1];
      const l = gray[i - 1], r = gray[i + 1];
      const bl = gray[i + w - 1], b = gray[i + w], br = gray[i + w + 1];
      const gx = tr + 2 * r + br - tl - 2 * l - bl;
      const gy = bl + 2 * b + br - tl - 2 * t - tr;
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

const EDGE_THRESHOLD = 0.35;

const THIRDS = [
  [1 / 3, 1 / 3],
  [2 / 3, 1 / 3],
  [1 / 3, 2 / 3],
  [2 / 3, 2 / 3],
];

export function canvasMetrics(img: ImageData, origW: number, origH: number, gray: Float32Array): CanvasMetrics {
  const { data, width: w, height: h } = img;
  const n = w * h;

  // Luminance histogram + clipping, one pass.
  const hist = new Array<number>(256).fill(0);
  let sum = 0;
  let sumSq = 0;
  let satSum = 0;
  const buckets = new Uint32Array(4096);
  const bucketR = new Float64Array(4096);
  const bucketG = new Float64Array(4096);
  const bucketB = new Float64Array(4096);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const v = gray[i];
    hist[Math.min(255, Math.round(v * 255))]++;
    sum += v;
    sumSq += v * v;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    buckets[k]++;
    bucketR[k] += r;
    bucketG[k] += g;
    bucketB[k] += b;
  }
  const mean = sum / n;
  const rms = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  let clipLow = 0;
  let clipHigh = 0;
  for (let i = 0; i <= 3; i++) clipLow += hist[i];
  for (let i = 252; i <= 255; i++) clipHigh += hist[i];
  const hMax = Math.max(...hist) || 1;

  // Palette diversity: 4 bits per channel, ignore buckets below 0.05% (sensor noise).
  const floor = n * 0.0005;
  let paletteCount = 0;
  let domK = 0;
  for (let k = 0; k < 4096; k++) {
    if (buckets[k] >= floor) paletteCount++;
    if (buckets[k] > buckets[domK]) domK = k;
  }
  const dc = buckets[domK] || 1;
  const dominant = hex(bucketR[domK] / dc, bucketG[domK] / dc, bucketB[domK] / dc);

  // Visual complexity + edge-weighted centroid.
  const mag = sobel(gray, w, h);
  let edges = 0;
  let cx = 0;
  let cy = 0;
  let wsum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const m = mag[y * w + x];
      if (m > EDGE_THRESHOLD) edges++;
      cx += m * x;
      cy += m * y;
      wsum += m;
    }
  }
  const centroid = wsum > 0 ? { x: cx / wsum / w, y: cy / wsum / h } : { x: 0.5, y: 0.5 };

  // Distance to the nearest third-intersection, in image space, over the diagonal.
  const diag = Math.hypot(origW, origH);
  let thirdsDistance = Infinity;
  for (const [tx, ty] of THIRDS) {
    const d = Math.hypot((centroid.x - tx) * origW, (centroid.y - ty) * origH) / diag;
    thirdsDistance = Math.min(thirdsDistance, d);
  }

  return {
    width: origW,
    height: origH,
    meanLuma: mean,
    rmsContrast: rms,
    clipLow: clipLow / n,
    clipHigh: clipHigh / n,
    histogram: hist.map((v) => v / hMax),
    edgeDensity: edges / n,
    paletteCount,
    centroid,
    thirdsDistance,
    dominant,
    saturation: satSum / n,
  };
}
