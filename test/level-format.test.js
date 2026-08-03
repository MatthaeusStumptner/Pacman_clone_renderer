import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_DOCUMENT_KIND, LEVEL_FORMAT_VERSION, compileWallGrid, createLevelDocument, reachableTileKeys, validateLevelDocument } from '../src/index.js';

const valid = () => createLevelDocument({ kind: LEVEL_DOCUMENT_KIND, schemaVersion: LEVEL_FORMAT_VERSION, id: 'test-level', board: { columns: 9, rows: 9, tileSize: 24, tunnelRows: [4], walls: [] }, actors: { player: { x: 4, y: 6 }, cats: [{ x: 4, y: 4, color: '#ff6b5f', accent: '#9e302e' }] }, collectibles: { powerUps: [{ x: 1, y: 1 }] } });

test('normalizes and validates the shared level format', () => {
  const result = validateLevelDocument(valid()); assert.equal(result.ok, true, result.errors.join('\n')); assert.equal(result.value.kind, LEVEL_DOCUMENT_KIND); assert.equal(result.value.schemaVersion, LEVEL_FORMAT_VERSION);
});

test('compiles border walls and tunnel openings', () => {
  const grid = compileWallGrid(valid()); assert.equal(grid[0][4], true); assert.equal(grid[4][0], false); assert.equal(grid[4][8], false);
});

test('rejects actors inside walls and finds reachable tiles', () => {
  const level = valid(); level.board.walls.push({ x: 4, y: 6, width: 1, height: 1 }); const result = validateLevelDocument(level);
  assert.equal(result.ok, false); assert.match(result.errors.join(' '), /Startpunkt/); assert.equal(reachableTileKeys(level).size, 0);
});

test('preserves extensible gameplay, decoration and pixel-character data', () => {
  const level = valid();
  level.gameplay = { pelletSeed: 194, treatTargets: { easy: 60, normal: 90, hard: 140 } };
  level.decorations = [{ id: 'tree-1', type: 'tree', x: 2, y: 3, width: 2, height: 2, color: '#33aa66' }];
  level.actors.cats[0].appearance = { width: 4, height: 4, palette: ['transparent', '#ff0000'], pixels: ['0110', '1111', '1001', '0110'] };
  const result = validateLevelDocument(level);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.value.gameplay.pelletSeed, 194);
  assert.equal(result.value.decorations[0].type, 'tree');
  assert.deepEqual(result.value.actors.cats[0].appearance.pixels, ['0110', '1111', '1001', '0110']);
  assert.ok(result.metrics.reachableTiles > 0);
});

test('preserves an intentionally empty cat list', () => {
  const level = valid(); level.actors.cats = [];
  assert.deepEqual(createLevelDocument(level).actors.cats, []);
});
