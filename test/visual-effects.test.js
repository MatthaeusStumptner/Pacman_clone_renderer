import test from 'node:test';
import assert from 'node:assert/strict';
import { drawLevelEdgeEffects, drawWithVisualEffects } from '../src/index.js';

function recordingContext() {
  const operations = [];
  let alpha = 1;
  const context = {
    operations,
    save() { operations.push('save'); }, restore() { operations.push('restore'); },
    beginPath() {}, rect() {}, clip() {}, translate() {},
    fillRect() { operations.push('fill'); }, strokeRect() { operations.push('stroke'); },
    moveTo() {}, lineTo() {}, stroke() { operations.push('line'); },
    set fillStyle(value) { operations.push(`fillStyle:${value}`); },
    set strokeStyle(value) { operations.push(`strokeStyle:${value}`); },
    set lineWidth(value) { operations.push(`lineWidth:${value}`); },
    get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
    set globalCompositeOperation(value) { operations.push(`composite:${value}`); },
    set filter(value) { operations.push(`filter:${value}`); },
    set shadowBlur(value) { operations.push(`shadowBlur:${value}`); },
  };
  return context;
}

test('stacks every visual effect without GPU-only filters or full-canvas blur', () => {
  const context = recordingContext();
  let draws = 0;
  const effects = ['glitch', 'neon', 'hologram', 'echo'].map((type, index) => ({ id: `${type}-${index}`, type, intensity: 0.6, speed: 1.2, color: '#55d9dd' }));
  drawWithVisualEffects(context, effects, { left: 10, top: 12, width: 32, height: 32 }, 1.5, () => { draws += 1; });
  assert.ok(draws > 4, 'stacked effects redraw clipped actor slices and echoes');
  assert.ok(context.operations.includes('composite:screen'));
  assert.ok(context.operations.includes('stroke'));
  assert.equal(context.operations.some((entry) => entry.startsWith('filter:')), false);
  assert.equal(context.operations.some((entry) => entry.startsWith('shadowBlur:')), false);
});

test('draws every animated level-edge type with deterministic Canvas2D primitives', () => {
  const context = recordingContext();
  const types = ['water-flow', 'fish', 'boat', 'leaves', 'fireflies', 'mist', 'city-lights', 'birds', 'steam', 'sparks', 'stage-pulse'];
  const level = {
    board: { columns: 25, rows: 25, tileSize: 24 },
    theme: {
      edgeEffects: types.map((type, index) => ({
        id: `${type}-${index}`, type, side: index % 2 ? 'left' : 'both',
        speed: 1 + index * 0.1, intensity: 0.6, count: 5,
        color: '#2379a3', accent: '#f5c451',
      })),
    },
  };
  drawLevelEdgeEffects(context, level, 2.25);
  assert.ok(context.operations.filter((entry) => entry === 'fill').length > 20);
  assert.ok(context.operations.includes('line'));
});
