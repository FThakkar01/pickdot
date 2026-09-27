/**
 * The verdict is rules, not a model. Every rule is a block you can read,
 * change and defend — when someone disagrees, show them the number.
 *
 * Copy rules: no "will", no predicted lift, no score out of 100. Confidence is
 * never above "moderate": directional accuracy for this kind of prediction is
 * about 70% (Hut & Masoero), so one pick in three is wrong.
 */
import { readText } from './analyze';
import { MIN_CONTRAST, MIN_FACE_PCT, MIN_TEXT_PX, PLATFORMS } from './platforms';
import type { ImageAnalysis, Platform, Profile, RuleResult, Slot, Verdict, Winner } from './types';

// ---------- profile signals ----------

const NEGATIVE = /\b(flop|flops|flopped|don'?t|doesn'?t|didn'?t|bad|poor|poorly|worse|tank|tanks|never|fail|fails|ignored|dies|die|dead|no one|nobody|not)\b/i;
const sentences = (t: string) => t.split(/[.!?\n;]+/).map((s) => s.trim()).filter(Boolean);
function mentions(text: string, topic: RegExp): 'up' | 'down' | null {
  const hits = sentences(text).filter((s) => topic.test(s));
  if (!hits.length) return null;
  const neg = hits.filter((s) => NEGATIVE.test(s)).length;
  return neg > hits.length / 2 ? 'down' : 'up';
}

export interface ProfileSignals {
  phoneFirst: boolean;
  faces: 'up' | 'down' | null;
  saturation: 'up' | 'down' | null;
  clutterAverse: boolean;
  thin: boolean;
}

export function profileSignals(p: Profile | null): ProfileSignals {
  if (!p) return { phoneFirst: false, faces: null, saturation: null, clutterAverse: false, thin: true };
  const worked = p.worked ?? '';
  const muted = mentions(worked, /\b(muted|pastel|desaturated|dull|washed)\b/i);
  const bright = mentions(worked, /\b(bright|bold colou?rs?|saturated|vibrant|colou?rful|neon)\b/i);
  const clutter = mentions(worked, /\b(busy|clutter|cluttered|messy)\b/i);
  const clean = mentions(worked, /\b(clean|simple|minimal)\b/i);
  return {
    phoneFirst:
      /\b(phone|phones|mobile|scroll|scrolling|reels|shorts|on the go)\b/i.test(p.audience) ||
      p.platform === 'ig_post' ||
      p.platform === 'ig_story',
    faces: mentions(worked, /\bfaces?\b|\bclose-?ups?\b|\bselfies?\b/i),
    saturation: muted === 'down' || bright === 'up' ? 'up' : muted === 'up' || bright === 'down' ? 'down' : null,
    clutterAverse:
      clutter === 'down' || clean === 'up' || p.tones.includes('minimal') || p.tones.includes('editorial'),
    thin: !worked.trim() || p.audience.trim().length < 15,
  };
}

// ---------- formatting ----------

const px = (v: number) => `${Math.round(v)}px`;
const ratio = (v: number) => `${v.toFixed(1)}:1`;
const pct = (v: number) => `${Math.round(v)}%`;
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const count = (n: number) => words[n] ?? String(n);
const other = (s: Slot): Slot => (s === 'A' ? 'B' : 'A');

// ---------- rules ----------

type Pair = Record<Slot, ImageAnalysis>;

function legibilitySize(p: Pair, platform: Platform, sig: ProfileSignals): RuleResult {
  const spec = PLATFORMS[platform];
  const t = { A: readText(p.A, platform), B: readText(p.B, platform) };
  const fails = (s: Slot) => t[s].headlinePx !== null && t[s].headlinePx! < MIN_TEXT_PX;
  const base: RuleResult = {
    id: 'text-size',
    label: `Largest text ≥ ${MIN_TEXT_PX}px at ${spec.short} size`,
    kind: 'hard',
    winner: null,
    baseWeight: 3,
    weight: 3,
    reason: '',
  };
  if (fails('A') === fails('B')) return base;
  const L: Slot = fails('A') ? 'A' : 'B';
  const W = other(L);
  const weight = sig.phoneFirst ? 4.5 : 3;
  const wText = t[W].headlinePx === null ? `${W} carries no detected text` : `${W}'s at ${px(t[W].headlinePx!)}`;
  return {
    ...base,
    winner: W,
    weight,
    weightNote: sig.phoneFirst ? 'phone-first audience ×1.5' : undefined,
    reason: `${L}'s largest text renders at ${px(t[L].headlinePx!)} at ${spec.label} size, under the ${MIN_TEXT_PX}px floor; ${wText}.`,
  };
}

function textContrast(p: Pair, platform: Platform): RuleResult {
  const t = { A: readText(p.A, platform), B: readText(p.B, platform) };
  const fails = (s: Slot) => t[s].headlineContrast !== null && t[s].headlineContrast! < MIN_CONTRAST;
  const base: RuleResult = {
    id: 'text-contrast',
    label: `Headline contrast ≥ ${MIN_CONTRAST}:1 (WCAG large text)`,
    kind: 'hard',
    winner: null,
    baseWeight: 3,
    weight: 3,
    reason: '',
  };
  if (fails('A') === fails('B')) return base;
  const L: Slot = fails('A') ? 'A' : 'B';
  const W = other(L);
  const wText = t[W].headlineContrast === null ? `${W} has no text to lose` : `${W}'s sits at ${ratio(t[W].headlineContrast!)}`;
  return {
    ...base,
    winner: W,
    reason: `${L}'s headline contrasts at ${ratio(t[L].headlineContrast!)} against its background, below ${MIN_CONTRAST}:1; ${wText}.`,
  };
}

function attentionFocus(p: Pair): RuleResult {
  const a = p.A.saliency, b = p.B.saliency;
  const base: RuleResult = {
    id: 'focus',
    label: 'Attention concentrated on one region beats attention split across several',
    kind: 'soft',
    winner: null,
    baseWeight: 2,
    weight: 2,
    reason: '',
  };
  if (a.regionCount === b.regionCount) return base;
  const W: Slot = a.regionCount < b.regionCount ? 'A' : 'B';
  const L = other(W);
  const gap = Math.abs(a.regionCount - b.regionCount);
  const shareGap = Math.abs(p.A.saliency.topShare - p.B.saliency.topShare);
  // A one-region step only counts when the lead region is clearly stronger.
  if (p[L].saliency.regionCount < 3 && gap < 2 && shareGap < 0.15) return base;
  const weight = p[W].saliency.regionCount === 1 && p[L].saliency.regionCount >= 3 ? 2 : 1;
  const wc = p[W].saliency.regionCount;
  return {
    ...base,
    winner: W,
    weight,
    baseWeight: weight,
    reason: `${W}'s predicted attention ${wc === 1 ? 'concentrates on one region' : `sits in ${count(wc)} regions`} (${pct(
      p[W].saliency.topShare * 100,
    )} in the strongest); ${L}'s splits across ${count(p[L].saliency.regionCount)}.`,
  };
}

function faceSize(p: Pair, sig: ProfileSignals): RuleResult {
  const base: RuleResult = {
    id: 'face',
    label: `Face fills ≥ ${MIN_FACE_PCT}% of frame`,
    kind: 'soft',
    winner: null,
    baseWeight: 1,
    weight: 1,
    reason: '',
  };
  if (p.A.faces.status !== 'ok' || p.B.faces.status !== 'ok') return base;
  const big = (s: Slot) => p[s].faces.largestPct >= MIN_FACE_PCT;
  if (big('A') === big('B')) return base;
  const withFace: Slot = big('A') ? 'A' : 'B';
  const W = sig.faces === 'down' ? other(withFace) : withFace;
  const L = other(W);
  const f = (s: Slot) => {
    const top = p[s].faces.list[0];
    return top ? `fills ${pct(top.areaPct)} of frame${top.expression !== 'neutral' ? `, ${top.expression}` : ''}` : 'shows no face';
  };
  const weight = sig.faces === 'up' ? 2 : 1;
  return {
    ...base,
    winner: W,
    weight,
    weightNote:
      sig.faces === 'up'
        ? 'your notes say faces work ×2'
        : sig.faces === 'down'
          ? 'your notes say faces flop — rule inverted'
          : undefined,
    reason:
      sig.faces === 'down'
        ? `${L}'s face ${f(L)}, and your notes say faces flop with your audience; ${W} ${f(W)}.`
        : `${W}'s face ${f(W)}; ${L} ${f(L).replace(/^fills/, 'fills only')}.`,
  };
}

function complexity(p: Pair, platform: Platform, sig: ProfileSignals): RuleResult {
  const ceiling = PLATFORMS[platform].complexityCeiling;
  const base: RuleResult = {
    id: 'complexity',
    label: `Edge density under ${pct(ceiling * 100)} for ${PLATFORMS[platform].short}`,
    kind: 'soft',
    winner: null,
    baseWeight: 1,
    weight: 1,
    reason: '',
  };
  const busy = (s: Slot) => p[s].metrics.edgeDensity > ceiling;
  if (busy('A') === busy('B')) return base;
  const L: Slot = busy('A') ? 'A' : 'B';
  const W = other(L);
  return {
    ...base,
    winner: W,
    weight: sig.clutterAverse ? 1.5 : 1,
    weightNote: sig.clutterAverse ? 'clean / minimal tone ×1.5' : undefined,
    reason: `${L} reads as busy at feed size: ${pct(p[L].metrics.edgeDensity * 100)} of its pixels sit on an edge, against ${pct(
      p[W].metrics.edgeDensity * 100,
    )} for ${W}.`,
  };
}

function saturation(p: Pair, sig: ProfileSignals): RuleResult {
  const base: RuleResult = {
    id: 'saturation',
    label: 'Colour saturation, only when your notes mention palette',
    kind: 'soft',
    winner: null,
    baseWeight: 1,
    weight: 1,
    reason: '',
  };
  if (!sig.saturation) return base;
  const a = p.A.metrics.saturation, b = p.B.metrics.saturation;
  if (Math.abs(a - b) < 0.1) return base;
  const moreSat: Slot = a > b ? 'A' : 'B';
  const W = sig.saturation === 'up' ? moreSat : other(moreSat);
  const L = other(W);
  const s = (x: Slot) => pct(p[x].metrics.saturation * 100);
  return {
    ...base,
    winner: W,
    weightNote: 'from your "what\'s worked" notes',
    reason:
      sig.saturation === 'up'
        ? `Your notes favour vivid colour; ${W}'s mean saturation is ${s(W)} against ${L}'s ${s(L)}.`
        : `Your notes favour a muted palette; ${W}'s mean saturation is ${s(W)} against ${L}'s ${s(L)}.`,
  };
}

function clipping(p: Pair): RuleResult {
  const base: RuleResult = {
    id: 'clipping',
    label: 'Under 12% of pixels crushed to black or blown to white',
    kind: 'soft',
    winner: null,
    baseWeight: 0.5,
    weight: 0.5,
    reason: '',
  };
  const clip = (s: Slot) => p[s].metrics.clipHigh + p[s].metrics.clipLow;
  const bad = (s: Slot) => clip(s) > 0.12;
  if (bad('A') === bad('B')) return base;
  const L: Slot = bad('A') ? 'A' : 'B';
  const W = other(L);
  return {
    ...base,
    winner: W,
    reason: `${pct(clip(L) * 100)} of ${L}'s pixels are clipped to pure black or white, losing detail; ${W} clips ${pct(clip(W) * 100)}.`,
  };
}

export function runRules(p: Pair, platform: Platform, sig: ProfileSignals): RuleResult[] {
  return [
    legibilitySize(p, platform, sig),
    textContrast(p, platform),
    attentionFocus(p),
    faceSize(p, sig),
    complexity(p, platform, sig),
    saturation(p, sig),
    clipping(p),
  ];
}

// ---------- verdict ----------

const NOISE = 1; // a gap this size or smaller (one soft signal) is inside noise
const MODERATE = 3;

function decide(rules: RuleResult[]): { winner: Winner; scoreA: number; scoreB: number; closeWhy?: string } {
  const scoreA = rules.filter((r) => r.winner === 'A').reduce((s, r) => s + r.weight, 0);
  const scoreB = rules.filter((r) => r.winner === 'B').reduce((s, r) => s + r.weight, 0);
  const hard = new Set(rules.filter((r) => r.kind === 'hard' && r.winner).map((r) => r.winner));
  if (hard.size > 1)
    return { winner: 'close', scoreA, scoreB, closeWhy: 'The hard rules disagree — each image fails a different legibility check.' };
  if (Math.abs(scoreA - scoreB) <= NOISE)
    return {
      winner: 'close',
      scoreA,
      scoreB,
      closeWhy:
        scoreA + scoreB === 0
          ? 'None of the rules separates these two.'
          : 'Only one soft signal separates them, and a gap that small is inside noise.',
    };
  return { winner: scoreA > scoreB ? 'A' : 'B', scoreA, scoreB };
}

/** Evaluate in the given order. Swapping A and B must not change the answer. */
function evaluateOrdered(first: ImageAnalysis, second: ImageAnalysis, platform: Platform, sig: ProfileSignals): Winner {
  // Re-key so the first-presented image is always "A" for the rule set.
  const pair: Pair = { A: { ...first, slot: 'A' }, B: { ...second, slot: 'B' } };
  const w = decide(runRules(pair, platform, sig)).winner;
  if (w === 'close') return 'close';
  const chosen = w === 'A' ? first : second;
  return chosen.slot;
}

export function judge(p: Pair, platform: Platform, profile: Profile | null): Verdict {
  const sig = profileSignals(profile);
  const rules = runRules(p, platform, sig);
  const d = decide(rules);
  const run1 = evaluateOrdered(p.A, p.B, platform, sig);
  const run2 = evaluateOrdered(p.B, p.A, platform, sig);
  // If order ever changes the answer, we do not know.
  const winner: Winner = run1 !== run2 ? 'close' : d.winner;

  const fired = rules.filter((r) => winner !== 'close' && r.winner === winner).sort((a, b) => b.weight - a.weight);
  const gap = Math.abs(d.scoreA - d.scoreB);
  const confidence = winner === 'close' ? null : gap >= MODERATE && fired.some((r) => r.kind === 'hard' || r.weight >= 2) ? 'moderate' : 'low';

  return {
    winner,
    confidence,
    scoreA: d.scoreA,
    scoreB: d.scoreB,
    rules,
    reasons: fired.slice(0, 3).map((r) => r.reason),
    profileLine: profileLine(sig, fired, profile),
    closeWhy: run1 !== run2 ? 'Swapping the order changed the answer, so it is not stable enough to state.' : d.closeWhy,
    run1,
    run2,
  };
}

function profileLine(sig: ProfileSignals, fired: RuleResult[], profile: Profile | null): string {
  if (!profile || sig.thin) return 'Your profile is thin, so this leans on generic rules rather than your audience.';
  const ids = new Set(fired.map((r) => r.id));
  if (sig.phoneFirst && ids.has('text-size')) return 'Your audience is phone-first, which weights legibility heavily.';
  if (sig.faces === 'up' && ids.has('face')) return 'Your notes say faces do well with your audience, so face size counts double.';
  if (sig.faces === 'down' && ids.has('face')) return 'Your notes say faces flop with your audience, so the face rule is inverted.';
  if (sig.clutterAverse && ids.has('complexity')) return 'You aim for a clean, minimal feel, so visual clutter counts harder against an image.';
  if (sig.saturation && ids.has('saturation')) return 'Your notes on palette brought colour saturation into the rules.';
  if (sig.phoneFirst) return 'Your audience is phone-first, so everything here is judged at feed size on a small screen.';
  return 'Nothing in your profile shifted the weighting on this pair, so these are the base rules.';
}
