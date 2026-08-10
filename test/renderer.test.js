import test from 'node:test';
import assert from 'node:assert/strict';
import { PassauPixelRenderer, createLevelDocument, drawActorPreview } from '../src/index.js';

function fakeCanvas({ width = 0, height = 0, onLayoutRead, onClientSizeRead } = {}) {
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
      if (property === 'measureText') return () => ({ width: 0 });
      return () => {};
    },
    set(target, property, value) { target[property] = value; return true; },
  });
  const scene = { width: 0, height: 0, getContext: () => context };
  return {
    width: 0, height: 0,
    get clientWidth() { onClientSizeRead?.(); return width; },
    get clientHeight() { onClientSizeRead?.(); return height; },
    getContext: (kind) => kind === '2d' ? context : null,
    ownerDocument: { createElement: () => scene },
    getBoundingClientRect() { onLayoutRead?.(); return { width, height }; },
  };
}

function fakePresentationBackend() {
  return {
    kind: 'canvas2d', resizeCalls: 0,
    resizeArguments: [],
    resize(width, height) { this.resizeCalls += 1; this.resizeArguments.push([width, height]); },
    present() {},
    snapshot: () => ({ backend: 'canvas2d' }),
  };
}

function sampleLevel() {
  return { id: 'resize-sample', board: { columns: 9, rows: 9, walls: [] }, actors: { cats: [] }, theme: { edgeEffects: [] } };
}

function sampleSnapshot() {
  return { level: sampleLevel() };
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

test('reuses externally measured display metrics without reading layout during render', () => {
  let layoutReads = 0;
  const canvas = fakeCanvas({ width: 412, height: 712, onLayoutRead: () => { layoutReads += 1; } });
  const renderer = new PassauPixelRenderer(canvas, { presentationBackend: fakePresentationBackend() });
  renderer.resize({ width: 412, height: 712, devicePixelRatio: 2.625, reason: 'observer' });
  const readsAfterResize = layoutReads;
  renderer.setLevel(sampleLevel());
  renderer.render(sampleSnapshot(), { cameraEnabled: true });
  assert.equal(layoutReads, readsAfterResize);
  assert.deepEqual(renderer.rendererInfo().display, {
    width: 412, height: 712, actualPixelRatio: 2.625, pixelRatio: 2,
    bufferWidth: 824, bufferHeight: 1424, reason: 'observer',
  });
});

test('skips backend resize for unchanged externally measured display metrics', () => {
  const backend = fakePresentationBackend();
  const renderer = new PassauPixelRenderer(fakeCanvas({ width: 412, height: 712 }), { presentationBackend: backend });
  renderer.resize({ width: 412, height: 712, devicePixelRatio: 2.625, reason: 'observer' });
  renderer.resize({ width: 412, height: 712, devicePixelRatio: 2.625, reason: 'observer' });
  assert.equal(backend.resizeCalls, 1);
  renderer.resize({ width: 412, height: 713, devicePixelRatio: 2.625, reason: 'observer' });
  assert.equal(backend.resizeCalls, 2);
});

test('normalizes zero externally measured display metrics without reading client size', () => {
  let clientSizeReads = 0;
  const canvas = fakeCanvas({ width: 412, height: 712, onClientSizeRead: () => { clientSizeReads += 1; } });
  const renderer = new PassauPixelRenderer(canvas, { presentationBackend: fakePresentationBackend() });
  assert.deepEqual(renderer.resize({ width: 0, height: 0, devicePixelRatio: 2, reason: 'hidden' }), {
    width: 1, height: 1, pixelRatio: 2, bufferWidth: 2, bufferHeight: 2, changed: true, reason: 'hidden',
  });
  assert.equal(clientSizeReads, 0);
});

test('normalizes non-finite externally measured dimensions before backend resize', () => {
  const backend = fakePresentationBackend();
  const renderer = new PassauPixelRenderer(fakeCanvas(), { presentationBackend: backend });
  assert.deepEqual(renderer.resize({ width: Infinity, height: -Infinity, devicePixelRatio: 2, reason: 'observer' }), {
    width: 1, height: 1, pixelRatio: 2, bufferWidth: 2, bufferHeight: 2, changed: true, reason: 'observer',
  });
  assert.deepEqual(backend.resizeArguments, [[2, 2]]);
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
  assert.equal(context.fills.length, 2);
  assert.deepEqual(context.fills.map((fill) => fill.slice(2)), [[56, 28], [56, 28]]);
});

test('actor previews render the gameplay fallback for cats without custom sprites', () => {
  const context = previewContext();
  drawActorPreview(context, { color: '#ff6b5f', accent: '#6fdb9e' }, { width: 48, height: 48 }, { kind: 'cat', state: 'left' });
  assert.ok(context.fills.length >= 10);
});
