import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCamera, projectWorldPoint } from '../src/index.js';

test('camera clamps at the world edges', () => {
  const camera = calculateCamera({ worldWidth: 600, worldHeight: 600, viewport: { x: 0, y: 64, width: 360, height: 576 }, target: { x: 0, y: 0 }, zoom: 1.1 });
  assert.equal(camera.source.x, 0); assert.equal(camera.source.y, 0); assert.ok(camera.source.width < 600);
  assert.deepEqual(projectWorldPoint(camera, { x: 0, y: 0 }), { x: 0, y: 64 });
});

test('camera is centered away from edges', () => {
  const camera = calculateCamera({ worldWidth: 600, worldHeight: 600, viewport: { x: 0, y: 0, width: 300, height: 500 }, target: { x: 300, y: 300 }, zoom: 1 });
  const point = projectWorldPoint(camera, { x: 300, y: 300 }); assert.equal(point.x, 150); assert.equal(point.y, 250);
});
