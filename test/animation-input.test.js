import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTIONS,
  DirectionalSwipeInput,
  createLevelDocument,
  queuePlayerDirection,
  selectAppearanceFrame,
  stateAnimationId,
} from '../src/index.js';

const rows = (token) => Array.from({ length: 4 }, () => token.repeat(4));

test('normalizes and resolves idle plus four directional animation states', () => {
  const level = createLevelDocument({
    board: { columns: 9, rows: 9 },
    actors: { cats: [], player: { x: 4, y: 4, appearance: {
      width: 4, height: 4, palette: ['transparent', '#ffffff'], pixels: rows('0'),
      animations: ['idle', 'up', 'right', 'down', 'left'].map((id) => ({ id, fps: 6, frames: [{ pixels: rows('1') }] })),
      stateAnimations: { idle: 'idle', up: 'up', right: 'right', down: 'down', left: 'left' },
    } } },
  });
  const appearance = level.actors.player.appearance;
  assert.deepEqual(appearance.stateAnimations, { idle: 'idle', up: 'up', right: 'right', down: 'down', left: 'left' });
  assert.equal(stateAnimationId(appearance, 'left'), 'left');
  assert.deepEqual(selectAppearanceFrame(appearance, { state: 'up', elapsed: 0 }), rows('1'));
});

test('falls back from directional states to a legacy walk animation', () => {
  const appearance = { width: 4, height: 4, palette: ['transparent', '#ffffff'], pixels: rows('0'), animations: [{ id: 'walk', fps: 6, loop: true, frames: [{ pixels: rows('1') }] }] };
  assert.equal(stateAnimationId(appearance, 'right'), 'walk');
  assert.deepEqual(selectAppearanceFrame(appearance, { state: 'right' }), rows('1'));
});

test('swipe input reacts during movement, rejects diagonal noise and supports corners', () => {
  const input = new DirectionalSwipeInput({ activationDistance: 4, dominanceRatio: 1.08 });
  input.begin({ x: 10, y: 10, pointerId: 7 });
  assert.equal(input.update({ x: 13, y: 12, pointerId: 7 }), null);
  assert.equal(input.update({ x: 16, y: 11, pointerId: 7 }), 'right');
  assert.equal(input.update({ x: 22, y: 11, pointerId: 7 }), null);
  assert.equal(input.update({ x: 22, y: 17, pointerId: 7 }), 'down');
  assert.equal(input.end({ x: 22, y: 17, pointerId: 7 }), null);
});

test('queued navigation reverses immediately but buffers perpendicular turns without teleporting', () => {
  const actor = { x: 4.37, y: 4, dir: DIRECTIONS.right, nextDir: DIRECTIONS.right };
  assert.equal(queuePlayerDirection(actor, DIRECTIONS.left), true);
  assert.equal(actor.dir, DIRECTIONS.left);
  assert.equal(actor.x, 4.37);
  assert.equal(queuePlayerDirection(actor, DIRECTIONS.up), false);
  assert.equal(actor.dir, DIRECTIONS.left);
  assert.equal(actor.nextDir, DIRECTIONS.up);
  assert.equal(actor.x, 4.37);
});

test('Zauberberg exposes its animated note and stage lights as editable theme elements', () => {
  const level = createLevelDocument({ theme: { landmark: 'zauberberg', elements: [{ id: 'stage-note', animation: { type: 'spin', speed: 2.5, amplitude: 0.4 } }] }, actors: { cats: [] } });
  assert.deepEqual(level.theme.elements, [
    { id: 'stage-note', animation: { type: 'spin', speed: 2.5, amplitude: 0.4 } },
    { id: 'stage-lights', animation: { type: 'none', speed: 1, amplitude: 0.15 } },
  ]);
});
