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
