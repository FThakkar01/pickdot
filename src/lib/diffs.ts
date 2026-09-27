/**
 * The measured half: only the numbers that differ, stated as facts with units.
 * Nothing here is a judgement, so nothing here is hedged.
 */
import { readText } from './analyze';
import { MIN_CONTRAST, MIN_FACE_PCT, MIN_TEXT_PX, PLATFORMS } from './platforms';
import type { ImageAnalysis, Platform, Slot } from './types';

export interface Diff {
  key: string;
  label: string;
  a: string;
  b: string;
  /** 0..1 bar lengths, for the mini comparison bars. */
  barA: number;
  barB: number;
  /** Which side crosses a published threshold, if any. */
  flag?: Slot;
  sentence: string;
  strength: number; // for ordering, larger = more different
}

const numWord = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

export function buildDiffs(p: Record<Slot, ImageAnalysis>, platform: Platform): Diff[] {
  const spec = PLATFORMS[platform];
  const out: Diff[] = [];
  const A = p.A, B = p.B;
  const tA = readText(A, platform), tB = readText(B, platform);

  // Text size at feed scale.
  if (tA.headlinePx !== null || tB.headlinePx !== null) {
    const a = tA.headlinePx, b = tB.headlinePx;
    const crosses = (a !== null && a < MIN_TEXT_PX) !== (b !== null && b < MIN_TEXT_PX);
    if (a === null || b === null || Math.abs(a - b) >= 3 || crosses) {
      const f = (v: number | null) => (v === null ? 'no text' : `${Math.round(v)}px`);
      const max = Math.max(a ?? 0, b ?? 0, MIN_TEXT_PX) * 1.1;
      out.push({
        key: 'text-size',
        label: `Largest text at ${spec.short} size`,
        a: f(a),
        b: f(b),
        barA: (a ?? 0) / max,
        barB: (b ?? 0) / max,
        flag: a !== null && a < MIN_TEXT_PX ? 'A' : b !== null && b < MIN_TEXT_PX ? 'B' : undefined,
        sentence: `A's largest text renders at ${f(a)} in a ${spec.displayNote}. B's at ${f(b)}.`,
        strength: crosses ? 10 : Math.abs((a ?? 0) - (b ?? 0)) / 4,
      });
    }
  }

  // Text contrast.
  if (tA.headlineContrast !== null && tB.headlineContrast !== null) {
    const a = tA.headlineContrast, b = tB.headlineContrast;
    const crosses = a < MIN_CONTRAST !== b < MIN_CONTRAST;
    if (crosses || Math.abs(a - b) >= 1.5) {
      out.push({
        key: 'text-contrast',
        label: 'Headline contrast (WCAG)',
        a: `${a.toFixed(1)}:1`,
        b: `${b.toFixed(1)}:1`,
        barA: Math.min(1, a / 21),
        barB: Math.min(1, b / 21),
        flag: a < MIN_CONTRAST ? 'A' : b < MIN_CONTRAST ? 'B' : undefined,
        sentence: `A's headline contrasts at ${a.toFixed(1)}:1. B's at ${b.toFixed(1)}:1.`,
        strength: crosses ? 9 : Math.abs(a - b) / 2,
      });
    }
  }

  // Faces.
  if (A.faces.status === 'ok' && B.faces.status === 'ok') {
    const a = A.faces.largestPct, b = B.faces.largestPct;
    if (Math.abs(a - b) >= 5 || (a > 0) !== (b > 0)) {
      const f = (v: number) => (v > 0 ? `${Math.round(v)}%` : 'no face');
      const max = Math.max(a, b, MIN_FACE_PCT) * 1.1;
      out.push({
        key: 'face',
        label: 'Largest face, share of frame',
        a: f(a),
        b: f(b),
        barA: a / max,
        barB: b / max,
        sentence: `A's face ${a > 0 ? `fills ${f(a)} of frame` : 'is absent'}. B's ${b > 0 ? `fills ${f(b)}` : 'is absent'}.`,
        strength: Math.abs(a - b) / 3,
      });
    }
  }

  // Attention regions.
  const ra = A.saliency.regionCount, rb = B.saliency.regionCount;
  if (ra !== rb || Math.abs(A.saliency.topShare - B.saliency.topShare) >= 0.15) {
    out.push({
      key: 'focus',
      label: 'Attention regions',
      a: `${ra}`,
      b: `${rb}`,
      barA: Math.min(1, ra / 5),
      barB: Math.min(1, rb / 5),
      sentence: `A's attention ${ra === 1 ? 'concentrates on one region' : `splits across ${numWord[ra] ?? ra} regions`}. B's ${
        rb === 1 ? 'concentrates on one' : `splits across ${numWord[rb] ?? rb}`
      }.`,
      strength: Math.abs(ra - rb) * 2 + Math.abs(A.saliency.topShare - B.saliency.topShare) * 5,
    });
  }

  // Visual complexity.
  const ea = A.metrics.edgeDensity, eb = B.metrics.edgeDensity;
  if (Math.abs(ea - eb) >= 0.04) {
    const max = Math.max(ea, eb, spec.complexityCeiling) * 1.1;
    out.push({
      key: 'complexity',
      label: 'Visual complexity (Sobel edge density)',
      a: `${Math.round(ea * 100)}%`,
      b: `${Math.round(eb * 100)}%`,
      barA: ea / max,
      barB: eb / max,
      flag: ea > spec.complexityCeiling ? 'A' : eb > spec.complexityCeiling ? 'B' : undefined,
      sentence: `${Math.round(ea * 100)}% of A's pixels sit on an edge. ${Math.round(eb * 100)}% of B's.`,
      strength: Math.abs(ea - eb) * 40,
    });
  }

  // Palette.
  const pa = A.metrics.paletteCount, pb = B.metrics.paletteCount;
  if (Math.max(pa, pb) / Math.max(1, Math.min(pa, pb)) >= 1.5 && Math.abs(pa - pb) >= 15) {
    const max = Math.max(pa, pb) * 1.1;
    out.push({
      key: 'palette',
      label: 'Distinct colours (4-bit buckets)',
      a: `${pa}`,
      b: `${pb}`,
      barA: pa / max,
      barB: pb / max,
      sentence: `A uses ${pa} distinct colour buckets. B uses ${pb}.`,
      strength: (Math.max(pa, pb) / Math.max(1, Math.min(pa, pb))) * 1.2,
    });
  }

  // Saturation.
  const sa = A.metrics.saturation, sb = B.metrics.saturation;
  if (Math.abs(sa - sb) >= 0.12) {
    out.push({
      key: 'saturation',
      label: 'Mean saturation',
      a: `${Math.round(sa * 100)}%`,
      b: `${Math.round(sb * 100)}%`,
      barA: sa,
      barB: sb,
      sentence: `A's mean saturation is ${Math.round(sa * 100)}%. B's is ${Math.round(sb * 100)}%.`,
      strength: Math.abs(sa - sb) * 12,
    });
  }

  // Brightness.
  const la = A.metrics.meanLuma, lb = B.metrics.meanLuma;
  if (Math.abs(la - lb) >= 0.15) {
    out.push({
      key: 'brightness',
      label: 'Mean brightness',
      a: `${Math.round(la * 100)}%`,
      b: `${Math.round(lb * 100)}%`,
      barA: la,
      barB: lb,
      sentence: `A averages ${Math.round(la * 100)}% brightness. B averages ${Math.round(lb * 100)}%.`,
      strength: Math.abs(la - lb) * 8,
    });
  }

  // Clipping.
  const ca = A.metrics.clipHigh + A.metrics.clipLow, cb = B.metrics.clipHigh + B.metrics.clipLow;
  if (Math.abs(ca - cb) >= 0.05) {
    const max = Math.max(ca, cb) * 1.1;
    out.push({
      key: 'clipping',
      label: 'Clipped pixels (pure black / white)',
      a: `${Math.round(ca * 100)}%`,
      b: `${Math.round(cb * 100)}%`,
      barA: ca / max,
      barB: cb / max,
      sentence: `${Math.round(ca * 100)}% of A's pixels are clipped. ${Math.round(cb * 100)}% of B's.`,
      strength: Math.abs(ca - cb) * 20,
    });
  }

  // Rule of thirds.
  const da = A.metrics.thirdsDistance, db = B.metrics.thirdsDistance;
  if ((da < 0.08 && db > 0.15) || (db < 0.08 && da > 0.15)) {
    out.push({
      key: 'thirds',
      label: 'Visual weight to nearest thirds point',
      a: `${Math.round(da * 100)}% of diag.`,
      b: `${Math.round(db * 100)}% of diag.`,
      barA: 1 - Math.min(1, da / 0.35),
      barB: 1 - Math.min(1, db / 0.35),
      sentence: `A's visual weight sits ${Math.round(da * 100)}% of the diagonal from a thirds point. B's sits ${Math.round(db * 100)}%.`,
      strength: Math.abs(da - db) * 15,
    });
  }

  return out.sort((x, y) => y.strength - x.strength);
}
