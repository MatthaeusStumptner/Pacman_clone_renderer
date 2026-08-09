import { Canvas2DPresentationBackend } from './canvas2d-backend.js';
import { createWebGL2Backend } from './webgl2-backend.js';
import { createWebGPUBackend } from './webgpu-backend.js';
import { resolveRendererQuality } from './effect-profile.js';

const backendName = (value) => ['canvas2d', 'webgl2', 'webgpu', 'auto'].includes(value) ? value : 'auto';

function probeResources(canvas, quality) {
  const document = canvas.ownerDocument ?? globalThis.document;
  const scene = document.createElement('canvas');
  const sceneScale = 1;
  scene.width = Math.round(600 * sceneScale); scene.height = Math.round(600 * sceneScale);
  const context = scene.getContext('2d');
  context.fillStyle = '#071016'; context.fillRect(0, 0, scene.width, scene.height);
  context.fillStyle = '#55d9dd';
  for (let index = 0; index < 180; index += 1) context.fillRect(index * 47 % scene.width, index * 83 % scene.height, 18, 18);
  const overlay = document.createElement('canvas'); overlay.width = 1; overlay.height = 1;
  return {
    scene,
    overlay,
    camera: { source: { x: 0, y: 0, width: 600, height: 600 }, viewport: { x: 0, y: 0, width: 720, height: 480 } },
    profile: { modeIndex: 6, intensity: 0.75, motionScale: 1, tint: [1, 0.31, 0.53], vignette: 0.14, power: 0, hit: 0, reducedMotion: false, scanlines: 0.06 },
    sceneScale,
  };
}

async function probeCandidate(canvas, kind, options, quality) {
  const document = canvas.ownerDocument ?? globalThis.document;
  const probeCanvas = document.createElement('canvas'); probeCanvas.width = 720; probeCanvas.height = 480;
  let backend;
  try {
    backend = kind === 'webgpu' ? await createWebGPUBackend(probeCanvas, options) : createWebGL2Backend(probeCanvas, options);
    if (!backend) return false;
    const resources = probeResources(canvas, quality);
    backend.resize(720, 480);
    for (let frame = 0; frame < 3; frame += 1) backend.present({ ...resources, hasOverlay: false, pixelRatio: 1, elapsed: frame / 60 });
    await backend.finish();
    const started = performance.now();
    for (let frame = 0; frame < 9; frame += 1) backend.present({ ...resources, hasOverlay: false, pixelRatio: 1, elapsed: frame / 60 });
    await backend.finish();
    const average = (performance.now() - started) / 9;
    // Modern integrated GPUs can still show conservative timings in a short
    // headless-style upload probe. Balanced and quality devices remain GPU
    // eligible up to one 60 Hz frame; constrained devices keep the strict gate.
    const threshold = quality === 'performance' ? 8 : 16.5;
    return average <= threshold;
  } catch {
    return false;
  } finally {
    backend?.destroy();
  }
}

export function createSyncPresentationBackend(canvas, options = {}) {
  const requested = backendName(options.backend);
  if (requested === 'webgpu') throw new Error('WebGPU benötigt PassauPixelRenderer.create(...).');
  if (requested === 'auto' || requested === 'webgl2') {
    const backend = createWebGL2Backend(canvas, options);
    if (backend) return backend;
    if (requested === 'webgl2' && options.fallback === false) throw new Error('WebGL 2 ist auf diesem Gerät nicht verfügbar.');
  }
  return new Canvas2DPresentationBackend(canvas);
}

export async function createPresentationBackend(canvas, options = {}) {
  const requested = backendName(options.backend);
  const quality = resolveRendererQuality(options.quality);
  if (requested === 'webgpu' || (requested === 'auto' && options.preferWebGPU !== false && await probeCandidate(canvas, 'webgpu', options, quality))) {
    try {
      const backend = await createWebGPUBackend(canvas, options);
      if (backend) return backend;
    } catch (error) {
      if (requested === 'webgpu' && options.fallback === false) throw error;
    }
  }
  if (requested === 'auto' && !await probeCandidate(canvas, 'webgl2', options, quality)) return new Canvas2DPresentationBackend(canvas);
  return createSyncPresentationBackend(canvas, { ...options, backend: requested === 'webgpu' ? 'auto' : requested });
}
