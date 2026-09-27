export type Slot = 'A' | 'B';

export type Platform = 'youtube' | 'ig_post' | 'ig_story' | 'linkedin' | 'ad';

export type Tone = 'playful' | 'authoritative' | 'warm' | 'minimal' | 'bold' | 'editorial';

export interface Profile {
  browserId: string;
  platform: Platform;
  audience: string;
  topics: string;
  tones: Tone[];
  worked: string;
  createdAt: number;
  updatedAt: number;
}

/** Layer 1: canvas maths. Deterministic, no model. */
export interface CanvasMetrics {
  width: number; // original pixels
  height: number;
  meanLuma: number; // 0..1 perceptual
  rmsContrast: number; // 0..1
  clipLow: number; // fraction of pixels crushed to black
  clipHigh: number; // fraction blown to white
  histogram: number[]; // 256 buckets, normalised to max = 1
  edgeDensity: number; // fraction of pixels on a Sobel edge
  paletteCount: number; // 4-bit/channel buckets holding >= 0.05% of pixels
  centroid: { x: number; y: number }; // edge-weighted, 0..1
  thirdsDistance: number; // distance from centroid to nearest third-intersection, as a fraction of the diagonal
  dominant: string; // hex
  saturation: number; // mean HSV saturation 0..1
}

/** A candidate text line, coordinates normalised 0..1. */
export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  contrast: number; // WCAG ratio between the two tone clusters inside the box
  fg: string;
  bg: string;
}

export interface SaliencyRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  share: number; // fraction of above-threshold attention mass
}

export interface Saliency {
  size: number; // grid is size x size, stretched to the image aspect
  map: Float32Array; // 0..1
  regions: SaliencyRegion[];
  regionCount: number;
  topShare: number;
  peak: { x: number; y: number };
}

export interface FaceInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  areaPct: number; // % of frame
  facing: 'camera' | 'turned';
  expression: 'smiling' | 'open mouth' | 'neutral';
}

export interface FaceReport {
  status: 'ok' | 'unavailable';
  list: FaceInfo[];
  largestPct: number; // 0 when none
}

export interface ImageAnalysis {
  slot: Slot;
  name: string;
  url: string; // object URL of the original
  thumb: string; // small data URL for history
  metrics: CanvasMetrics;
  saliency: Saliency;
  textBoxes: TextBox[];
  faces: FaceReport;
}

/** Text numbers depend on the platform, so they are derived, not stored. */
export interface TextReading {
  headlinePx: number | null;
  smallestPx: number | null;
  headlineContrast: number | null;
  minContrast: number | null;
}

export type Winner = Slot | 'close';

export interface RuleResult {
  id: string;
  label: string;
  kind: 'hard' | 'soft';
  winner: Slot | null; // null = rule did not separate the two
  weight: number; // after profile weighting
  baseWeight: number;
  reason: string; // stated from the winner's side
  weightNote?: string; // why the profile changed the weight
}

export interface Verdict {
  winner: Winner;
  confidence: 'low' | 'moderate' | null;
  scoreA: number;
  scoreB: number;
  rules: RuleResult[];
  reasons: string[];
  profileLine: string;
  closeWhy?: string;
  run1: Winner;
  run2: Winner;
}

export interface Outcome {
  posted: Slot | 'neither';
  performance: 'better' | 'same' | 'worse' | null;
  note: string;
  loggedAt: number;
}

export interface ComparisonRecord {
  id: string;
  createdAt: number;
  platform: Platform;
  nameA: string;
  nameB: string;
  thumbA: string;
  thumbB: string;
  run1: Winner;
  run2: Winner;
  verdict: Winner;
  confidence: Verdict['confidence'];
  reasons: string[];
  profileLine: string;
  outcome?: Outcome;
  outcomeDismissed?: boolean;
}
