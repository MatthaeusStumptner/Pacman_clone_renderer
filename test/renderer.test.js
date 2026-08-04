import test from 'node:test';
import assert from 'node:assert/strict';
import { PassauPixelRenderer, createLevelDocument, drawActorPreview } from '../src/index.js';

function fakeCanvas() {
  const context = { setTransform() {}, imageSmoothingEnabled: false };
  const scene = { width: 0, height: 0, getContext: () => context };
  return { getContext: () => context, ownerDocument: { createElement: () => scene } };
}

test('rebuilds a same-id level when the immutable input document changes', () => {
  const renderer = new PassauPixelRenderer(fakeCanvas(), { pixelRatio: 1 });
  const first = createLevelDocument({ id: 'same-id', board: { columns: 9, rows: 9, walls: [] }, actors: { cats: [] } });
  const second = createLevelDocument({ ...first, board: { ...first.board, walls: [{ x: 3, y: 3, width: 1, height: 1 }] } });
  renderer.setLevel(first);
  renderer.setLevelIfChanged(second);
  assert.equal(renderer.grid[3][3], true);
  assert.equal(renderer.level.board.walls.length, 1);
});

function previewContext() {
  const fills = [];
  return {
    fills,
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, scale() {},
    fillRect(...args) { fills.push(args); },
    strokeRect() {}, moveTo() {}, lineTo() {}, stroke() {},
    set fillStyle(value) {}, set strokeStyle(value) {}, set lineWidth(value) {},
  };
}

test('actor previews use the same custom appearance painter as the game', () => {
  const context = previewContext();
  const actor = { appearance: {
    width: 2, height: 2, palette: ['transparent', '#ffffff'], pixels: ['11', '11'],
    animations: [{ id: 'right', fps: 2, loop: true, frames: [{ pixels: ['11', '11'] }] }],
    stateAnimations: { right: 'right' },
  } };
  assert.equal(drawActorPreview(context, actor, { left: 0, top: 0, width: 80, height: 50 }, { state: 'right', elapsed: 0.25 }), true);
  assert.equal(context.fills.length, 4);
});

test('actor previews render the gameplay fallback for cats without custom sprites', () => {
  const context = previewContext();
  drawActorPreview(context, { color: '#ff6b5f', accent: '#6fdb9e' }, { width: 48, height: 48 }, { kind: 'cat', state: 'left' });
  assert.ok(context.fills.length >= 10);
});
