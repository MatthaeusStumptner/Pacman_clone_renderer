# Renderer CI benchmark gate

## Root cause

GitHub Actions run `31453982412`, job `93663904316` measured Auto-backend render p95 values around 5–7 ms, inside their profile budgets. The same CDP-throttled Chromium process delivered 30/20 Hz `requestAnimationFrame` cadence, producing frame-only experience failures (for example 49.9 ms frame p95 and 42% long frames). The old assertion treated every Auto experience-budget failure as a renderer-work failure.

## Contract

`selectBenchmarkAssertions(results)` separates the unchanged experience diagnostic from the deterministic CI gate:

- `renderWorkFailures`: Auto rows with render p95 over their profile render-p95 budget; these fail `benchmark:assert`.
- `experienceDiagnostics`: every failing Auto experience budget, unchanged and retained in JSON.
- `warnings`: frame/long-frame-only Auto experience failures; visible diagnostics that do not fail the renderer-work command.
- `nonAutoDiagnostics`: failing explicitly requested backend rows; diagnostic only, as before.

No renderer implementation, shader, budget, browser pacing contract, or workflow order changed.

## TDD evidence

RED: `node --test test/benchmark-assertion.test.js` failed with `ERR_MODULE_NOT_FOUND` for the not-yet-created helper.

GREEN: the same focused command passed 3/3 tests covering GitHub-shaped frame-only failure, Auto render-p95 overflow, and explicit backend diagnostics.

## Full verification

- `npm test` — 102/102 passed.
- `npm run build` — passed.
- `npm run benchmark:assert` — passed; JSON included the structured `assertion` result with no local render-work failures.
- `npm run test:browser` — passed; deterministic pacer report was `121/121/121` for 60/120/175 Hz.

`apply_patch` could create new files but could not read the existing benchmark script because of the known Windows ACL helper error. The script wiring therefore used exact, count-guarded PowerShell replacements followed immediately by `node --check` and `git diff --check`.
