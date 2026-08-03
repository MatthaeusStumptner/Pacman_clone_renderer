import test from 'node:test';
import assert from 'node:assert/strict';
import { PassauPixelRenderer, createLevelDocument } from '../src/index.js';

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
