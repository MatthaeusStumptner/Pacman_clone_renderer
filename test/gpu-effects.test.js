import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEVEL_EFFECT_PROFILES, rendererPixelRatioLimit, resolvePostProcessProfile, resolveRendererQuality } from '../src/gpu/effect-profile.js';
import { WEBGL_FRAGMENT_SHADER, WEBGPU_SHADER } from '../src/gpu/shaders.js';

test('keeps modern notebooks, tablets and phones eligible for GPU effects', () => {
  assert.equal(resolveRendererQuality('auto', { deviceMemory: 2, hardwareConcurrency: 2 }), 'performance');
  assert.equal(rendererPixelRatioLimit('performance'), 1.25);
  assert.equal(resolveRendererQuality('auto', { deviceMemory: 4, hardwareConcurrency: 8 }), 'balanced');
  assert.equal(resolveRendererQuality('auto', { deviceMemory: 8, hardwareConcurrency: 8 }), 'quality');
  assert.equal(resolveRendererQuality('auto', { deviceMemory: 16, hardwareConcurrency: 12 }), 'quality');
});

test('derives playful GPU effects from authored level edges', () => {
  const water = resolvePostProcessProfile({ theme: { palette: { water: '#2379a3' }, edgeEffects: [{ type: 'water-flow', intensity: 0.8 }] } }, { powerTimer: 3 }, { quality: 'quality' });
  assert.equal(water.mode, 'water');
  assert.equal(water.modeIndex, 1);
  assert.equal(water.power, 0.5);
  assert.ok(water.intensity >= 0.7);
  const reduced = resolvePostProcessProfile({ theme: { edgeEffects: [{ type: 'stage-pulse', intensity: 1 }] } }, {}, { reducedMotion: true });
  assert.equal(reduced.mode, 'stage');
  assert.equal(reduced.motionScale, 0);
  assert.equal(reduced.distortion, 0);
});

test('uses a restrained authored signature for every published level', () => {
  assert.deepEqual(Object.keys(LEVEL_EFFECT_PROFILES), ['home', 'hals', 'oberhaus', 'dom', 'dreifluesseeck', 'uni', 'bschuett', 'tabakfabrik', 'zauberberg']);
  const home = resolvePostProcessProfile({ id: 'home', theme: { edgeEffects: [{ type: 'water-flow', intensity: 1 }] } }, {}, { quality: 'quality' });
  const river = resolvePostProcessProfile({ id: 'dreifluesseeck', theme: { edgeEffects: [{ type: 'water-flow', intensity: 1 }] } }, {}, { quality: 'quality' });
  assert.equal(home.mode, 'nature');
  assert.ok(home.distortion <= 0.02);
  assert.equal(river.mode, 'water');
  assert.ok(river.distortion > home.distortion);
  assert.ok(river.distortion <= 0.4);
});

test('ships compatible GLSL and WGSL fragment entry points without WGSL swizzle writes', () => {
  assert.match(WEBGL_FRAGMENT_SHADER, /void main\(\)/);
  assert.match(WEBGPU_SHADER, /@fragment fn fragmentMain/);
  assert.doesNotMatch(WEBGPU_SHADER, /color\.rgb\s*[+*]?=/);
  assert.match(WEBGPU_SHADER, /var rgb = color\.rgb/);
});

test('prepares browser canvases for valid WebGPU texture uploads', async () => {
  const source = await readFile(new URL('../src/gpu/webgpu-backend.js', import.meta.url), 'utf8');

  assert.match(source, /GPUTextureUsage\.RENDER_ATTACHMENT/);
  assert.match(source, /emptyOverlay\.getContext\('2d'\)/);
});
