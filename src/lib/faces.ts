/**
 * Faces: presence, size, head pose, expression — MediaPipe Face Landmarker
 * (Apache-2.0). WASM delegate by default; the runtime is served from our own
 * origin and the model is cached by the browser after the first visit.
 * Loaded lazily, used for both images, then closed to free memory.
 */
import type { FaceInfo, FaceReport } from './types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Landmarker = import('@mediapipe/tasks-vision').FaceLandmarker;

export async function openFaceLandmarker(timeoutMs = 25000): Promise<Landmarker | null> {
  try {
    const run = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(new URL('mediapipe', document.baseURI).href);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 4,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
      });
    })();
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
    return await Promise.race([run, timeout]);
  } catch (err) {
    console.warn('[Pickdot] face model unavailable', err);
    return null;
  }
}

export function detectFaces(lm: Landmarker | null, source: HTMLCanvasElement): FaceReport {
  if (!lm) return { status: 'unavailable', list: [], largestPct: 0 };
  try {
    const res = lm.detect(source);
    const list: FaceInfo[] = res.faceLandmarks.map((pts, i) => {
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const p of pts) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(1, x1); y1 = Math.min(1, y1);

      // Yaw from where the nose tip sits between the outer eye corners.
      const nose = pts[1], le = pts[33], re = pts[263];
      const ratio = (nose.x - le.x) / (re.x - le.x || 1e-6);
      const facing = Math.abs(ratio - 0.5) < 0.14 ? 'camera' : 'turned';

      const shapes = res.faceBlendshapes[i]?.categories ?? [];
      const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
      const smile = (score('mouthSmileLeft') + score('mouthSmileRight')) / 2;
      const jaw = score('jawOpen');
      const expression = smile > 0.4 ? 'smiling' : jaw > 0.35 ? 'open mouth' : 'neutral';

      const w = x1 - x0, h = y1 - y0;
      return { x: x0, y: y0, w, h, areaPct: w * h * 100, facing, expression } satisfies FaceInfo;
    });
    list.sort((a, b) => b.areaPct - a.areaPct);
    return { status: 'ok', list, largestPct: list[0]?.areaPct ?? 0 };
  } catch (err) {
    console.warn('[Pickdot] face detection failed', err);
    return { status: 'unavailable', list: [], largestPct: 0 };
  }
}
