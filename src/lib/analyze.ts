import type { WorkerMessage, WorkerRequest } from './analyze.worker';
import { detectFaces, openFaceLandmarker } from './faces';
import { PLATFORMS } from './platforms';
import { addFacePrior, describeSaliency } from './saliency';
import type { ImageAnalysis, Platform, Slot, TextBox, TextReading } from './types';

const WORK_SIDE = 512; // canvas maths + saliency + text
const FACE_SIDE = 1024; // faces want more pixels

export type Stage = 'read' | 'canvas' | 'saliency' | 'text' | 'faces' | 'done';

export const STAGES: { id: Stage; label: string; detail: string }[] = [
  { id: 'read', label: 'Reading pixels', detail: 'decode in-browser, nothing uploaded' },
  { id: 'canvas', label: 'Canvas maths', detail: 'luminance, edges, palette, thirds' },
  { id: 'saliency', label: 'Attention map', detail: 'spectral residual, opponent colour' },
  { id: 'text', label: 'Text regions', detail: 'line boxes, glyph contrast' },
  { id: 'faces', label: 'Faces', detail: 'size, pose, expression' },
];

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * s));
  c.height = Math.max(1, Math.round(bitmap.height * s));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // Platforms flatten transparent PNGs; unflattened, clear pixels read as black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

function thumbnail(bitmap: ImageBitmap): string {
  return draw(bitmap, 160).toDataURL('image/jpeg', 0.72);
}

export async function analyzePair(
  files: Record<Slot, File>,
  onStage: (s: Stage) => void,
): Promise<Record<Slot, ImageAnalysis>> {
  onStage('read');
  const slots: Slot[] = ['A', 'B'];
  const bitmaps = {} as Record<Slot, ImageBitmap>;
  for (const s of slots) bitmaps[s] = await createImageBitmap(files[s]);

  // Start the face model downloading while the worker crunches pixels.
  const landmarkerP = openFaceLandmarker();

  const worker = new Worker(new URL('./analyze.worker.ts', import.meta.url), { type: 'module' });
  const raw = await new Promise<Record<Slot, Extract<WorkerMessage, { type: 'result' }>>>((resolve, reject) => {
    const out = {} as Record<Slot, Extract<WorkerMessage, { type: 'result' }>>;
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'progress' && m.slot === 'A') onStage(m.stage);
      if (m.type === 'error') reject(new Error(m.message));
      if (m.type === 'result') {
        out[m.slot] = m;
        if (out.A && out.B) resolve(out);
      }
    };
    worker.onerror = (e) => reject(new Error(e.message));
    for (const s of slots) {
      const c = draw(bitmaps[s], WORK_SIDE);
      const image = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      const req: WorkerRequest = { slot: s, image, origW: bitmaps[s].width, origH: bitmaps[s].height };
      worker.postMessage(req, [image.data.buffer]);
    }
  }).finally(() => worker.terminate());

  onStage('faces');
  const landmarker = await landmarkerP;
  const result = {} as Record<Slot, ImageAnalysis>;
  for (const s of slots) {
    const faces = detectFaces(landmarker, draw(bitmaps[s], FACE_SIDE));
    const map = addFacePrior(raw[s].saliency, faces.list);
    result[s] = {
      slot: s,
      name: files[s].name,
      url: URL.createObjectURL(files[s]),
      thumb: thumbnail(bitmaps[s]),
      metrics: raw[s].metrics,
      saliency: describeSaliency(map),
      textBoxes: raw[s].textBoxes,
      faces,
    };
    bitmaps[s].close();
  }
  landmarker?.close();
  onStage('done');
  return result;
}

/** Rendered text size depends on where the image is shown, so it is derived per platform. */
export function readText(a: ImageAnalysis, platform: Platform): TextReading {
  const boxes: TextBox[] = a.textBoxes;
  if (!boxes.length) return { headlinePx: null, smallestPx: null, headlineContrast: null, minContrast: null };
  const spec = PLATFORMS[platform];
  const displayH = spec.displayWidth * (a.metrics.height / a.metrics.width);
  const px = (b: TextBox) => b.h * displayH;
  const byHeight = [...boxes].sort((x, y) => y.h - x.h);
  const headline = byHeight[0];
  return {
    headlinePx: px(headline),
    smallestPx: px(byHeight[byHeight.length - 1]),
    headlineContrast: headline.contrast,
    minContrast: Math.min(...boxes.map((b) => b.contrast)),
  };
}
