import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPresentationBackend } from '../src/gpu/presentation-backend.js';
import { createWebGPUBackend, webGPUAdapterOptions } from '../src/gpu/webgpu-backend.js';

test('omits ignored WebGPU power preference on Windows', () => {
  assert.deepEqual(webGPUAdapterOptions(
    { powerPreference: 'high-performance' },
    { userAgentData: { platform: 'Windows' } },
  ), {});
  assert.deepEqual(webGPUAdapterOptions(
    { powerPreference: 'high-performance' },
    { userAgentData: { platform: 'Android' } },
  ), { powerPreference: 'high-performance' });
});

test('selects backends by capability without rendering probe frames', async () => {
  const calls = [];
  const backend = await selectPresentationBackend('auto', {
    webgpu: async () => { calls.push('webgpu'); throw new Error('adapter unavailable'); },
    webgl2: () => { calls.push('webgl2'); return { kind: 'webgl2' }; },
    canvas2d: () => { calls.push('canvas2d'); return { kind: 'canvas2d' }; },
  });

  assert.equal(backend.kind, 'webgl2');
  assert.deepEqual(calls, ['webgpu', 'webgl2']);
  assert.match(backend.fallbackReason, /adapter unavailable/);
});

test('propagates explicit backend initialization errors when fallback is disabled', async () => {
  for (const requested of ['webgpu', 'webgl2']) {
    const initializationError = new Error(requested + ' initialization failed');
    const calls = [];

    await assert.rejects(
      selectPresentationBackend(requested, {
        webgpu: async () => { calls.push('webgpu'); throw initializationError; },
        webgl2: () => { calls.push('webgl2'); throw initializationError; },
        canvas2d: () => { calls.push('canvas2d'); return { kind: 'canvas2d' }; },
      }, { fallback: false }),
      (error) => error === initializationError,
    );
    assert.deepEqual(calls, [requested]);
  }
});

test('skips WebGPU deterministically when automatic selection opts out', async () => {
  const calls = [];
  const backend = await selectPresentationBackend('auto', {
    webgpu: async () => { calls.push('webgpu'); return { kind: 'webgpu' }; },
    webgl2: () => { calls.push('webgl2'); return { kind: 'webgl2' }; },
    canvas2d: () => { calls.push('canvas2d'); return { kind: 'canvas2d' }; },
  }, { preferWebGPU: false });

  assert.equal(backend.kind, 'webgl2');
  assert.deepEqual(calls, ['webgl2']);
});

test('adds deterministic diagnostics to the selected backend snapshot', async () => {
  const backend = await selectPresentationBackend('auto', {
    webgpu: async () => ({
      kind: 'webgpu',
      snapshot: () => ({ backend: 'webgpu', frameCount: 0 }),
    }),
    webgl2: () => { throw new Error('WebGL2 should not be initialized'); },
    canvas2d: () => { throw new Error('Canvas2D should not be initialized'); },
  });

  assert.deepEqual(backend.snapshot(), {
    requestedBackend: 'auto',
    backend: 'webgpu',
    frameCount: 0,
    fallbackReason: null,
  });
});

function unavailableWebGPU() {
  const calls = { adapterOptions: null, deviceDestroys: 0 };
  const device = {
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createRenderPipelineAsync: async () => ({}),
    destroy: () => { calls.deviceDestroys += 1; },
  };
  const adapter = { requestDevice: async () => device };
  const gpu = {
    requestAdapter: async (options) => { calls.adapterOptions = options; return adapter; },
    getPreferredCanvasFormat: () => 'rgba8unorm',
  };
  const canvas = { getContext: () => null };
  return { calls, canvas, gpu };
}

async function withNavigator(navigator, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  try {
    return await callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
}

test('uses Windows-safe adapter options during WebGPU initialization', async () => {
  const { calls, canvas, gpu } = unavailableWebGPU();

  const backend = await withNavigator(
    { userAgentData: { platform: 'Windows' } },
    () => createWebGPUBackend(canvas, { gpu, powerPreference: 'high-performance' }),
  );

  assert.equal(backend, null);
  assert.deepEqual(calls.adapterOptions, {});
});

test('releases a WebGPU device when its canvas context is unavailable', async () => {
  const { calls, canvas, gpu } = unavailableWebGPU();

  const backend = await createWebGPUBackend(canvas, { gpu });

  assert.equal(backend, null);
  assert.equal(calls.deviceDestroys, 1);
});

test('propagates the terminal initialization error when every fallback fails', async () => {
  const terminalError = new Error('Canvas2D context creation failed');

  await assert.rejects(
    selectPresentationBackend('auto', {
      webgpu: async () => { throw new Error('adapter unavailable'); },
      webgl2: () => { throw new Error('WebGL2 unavailable'); },
      canvas2d: () => { throw terminalError; },
    }),
    (error) => error === terminalError,
  );
});
