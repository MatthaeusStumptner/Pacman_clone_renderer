import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBenchmarkAssertions } from '../scripts/benchmark-assertion.js';

const autoRow = ({ renderP95Ms = 6, frameP95Ms = 16, longFramePercent = 0 } = {}) => ({
  requestedBackend: 'auto',
  profile: 'notebook',
  scene: 'gameplay',
  renderP95Ms,
  frameP95Ms,
  longFramePercent,
  budget: {
    passed: renderP95Ms <= 14 && frameP95Ms <= 34 && longFramePercent <= 15,
    budget: { renderP95Ms: 14, frameP95Ms: 34, longFramePercent: 15 },
    failures: [],
  },
});

test('keeps a GitHub-shaped auto frame-only budget failure as a diagnostic warning', () => {
  const row = autoRow({ renderP95Ms: 6.8, frameP95Ms: 49.9, longFramePercent: 42 });
  row.budget.passed = false;
  row.budget.failures = ['Frame-p95 49.9 ms > 34 ms', 'Lange Frames 42% > 15%'];

  const selection = selectBenchmarkAssertions([row]);

  assert.equal(selection.passed, true);
  assert.deepEqual(selection.renderWorkFailures, []);
  assert.deepEqual(selection.experienceDiagnostics, [row]);
  assert.deepEqual(selection.warnings, [row]);
});

test('fails the auto renderer-work gate when render p95 exceeds its profile budget', () => {
  const row = autoRow({ renderP95Ms: 14.1 });
  row.budget.passed = false;
  row.budget.failures = ['Render-p95 14.1 ms > 14 ms'];

  const selection = selectBenchmarkAssertions([row]);

  assert.equal(selection.passed, false);
  assert.deepEqual(selection.renderWorkFailures, [row]);
  assert.deepEqual(selection.warnings, []);
});

test('leaves explicit backend rows as diagnostics rather than asserted benchmark rows', () => {
  const row = { ...autoRow({ renderP95Ms: 50 }), requestedBackend: 'webgl2' };
  row.budget.passed = false;
  row.budget.failures = ['Render-p95 50 ms > 14 ms'];

  const selection = selectBenchmarkAssertions([row]);

  assert.equal(selection.passed, true);
  assert.deepEqual(selection.assertedRows, []);
  assert.deepEqual(selection.renderWorkFailures, []);
  assert.deepEqual(selection.nonAutoDiagnostics, [row]);
});
