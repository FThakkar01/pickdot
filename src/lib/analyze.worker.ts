/// <reference lib="webworker" />
import { canvasMetrics, toGray } from './metrics';
import { spectralResidual } from './saliency';
import { detectText } from './textdetect';
import type { Slot } from './types';

export interface WorkerRequest {
  slot: Slot;
  image: ImageData;
  origW: number;
  origH: number;
}

export type WorkerMessage =
  | { type: 'progress'; slot: Slot; stage: 'canvas' | 'saliency' | 'text' }
  | {
      type: 'result';
      slot: Slot;
      metrics: ReturnType<typeof canvasMetrics>;
      saliency: Float32Array;
      textBoxes: ReturnType<typeof detectText>;
      ms: number;
    }
  | { type: 'error'; slot: Slot; message: string };

const post = (m: WorkerMessage, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { slot, image, origW, origH } = e.data;
  try {
    const t0 = performance.now();
    post({ type: 'progress', slot, stage: 'canvas' });
    const gray = toGray(image.data, image.width * image.height);
    const metrics = canvasMetrics(image, origW, origH, gray);
    post({ type: 'progress', slot, stage: 'saliency' });
    const saliency = spectralResidual.run(image);
    post({ type: 'progress', slot, stage: 'text' });
    const textBoxes = detectText(image, gray);
    post(
      { type: 'result', slot, metrics, saliency, textBoxes, ms: performance.now() - t0 },
      [saliency.buffer],
    );
  } catch (err) {
    post({ type: 'error', slot, message: err instanceof Error ? err.message : String(err) });
  }
};
