import test from 'node:test';
import assert from 'node:assert/strict';
import { rendererPixelRatioLimit, resolvePostProcessProfile, resolveRendererQuality } from '../src/gpu/effect-profile.js';

test('selects a conservative quality tier for weak mobile hardware', () => {
  assert.equal(resolveRendererQuality('auto', { deviceMemory: 3, hardwareConcurrency: 4 }), 'performance');
  assert.equal(rendererPixelRatioLimit('performance'), 1.25);
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
});
