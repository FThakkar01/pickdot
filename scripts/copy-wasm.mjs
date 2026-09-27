// Copies the MediaPipe vision WASM runtime into public/ so faces work offline
// after first load and never depend on a CDN version matching package.json.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/mediapipe';
if (!existsSync(src)) process.exit(0);
mkdirSync(dest, { recursive: true });
for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) cpSync(`${src}/${f}`, `${dest}/${f}`);
