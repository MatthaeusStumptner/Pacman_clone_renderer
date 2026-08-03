import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ships a machine-readable schema for the public level contract', async () => {
  const schema = JSON.parse(await readFile(new URL('../schema/franz-lola-level.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(schema.properties.kind, { const: 'franz-lola-level' });
  assert.ok(schema.required.includes('board'));
  assert.ok(schema.$defs.decoration);
  assert.ok(schema.$defs.appearance);
  assert.ok(schema.$defs.appearance.properties.animations);
  assert.ok(schema.$defs.actorBehavior);
  assert.ok(schema.$defs.difficultyProfile);
  assert.ok(schema.$defs.motionAnimation);
  assert.ok(schema.$defs.levelEvent);
  assert.ok(schema.properties.events);
});
