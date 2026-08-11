# Renderer CI follow-up — deterministic benchmark gate

## Evidence and root cause

GitHub Actions run `31453982412`, job `93663904316`, passed `npm test` and `npm run build`, then failed `npm run benchmark:assert`. Auto-backend render work stayed well inside its render p95 budgets (roughly 5–7 ms in the affected notebook/tablet rows), but CDP CPU throttling caused headless Chromium's `requestAnimationFrame` cadence to collapse to roughly 30 Hz and occasionally 20 Hz. The full experience budget then reported 32–42% frames over the hard-coded 33.34 ms long-frame threshold and some 49.9 ms frame p95 values. Those values describe GitHub-runner scheduling under CDP throttling, not renderer work.

Presentation pacing is already a separate deterministic CI contract in `scripts/browser-regression.mjs` and its harness tests: 60/120/175 Hz sequences must stay within the presentation ceiling, and the workflow runs `npm run test:browser` after the benchmark.

## Required fix boundary

- Preserve the full `summarizeRenderSamples()` and `evaluatePerformanceBudget()` experience diagnostics in benchmark JSON. Do not falsify, clamp, loosen, or remove measured frame/long-frame values.
- Make `benchmark:assert` gate deterministic renderer work for auto-backend scenarios, not external rAF cadence under CDP throttling.
- Add an explicit, structured assertion result/helper rather than string-matching localized failure messages.
- Auto scenarios exceeding their profile's render p95 budget must still fail.
- Frame-only/long-frame-only experience-budget failures must be reported as warnings/diagnostics but must not fail this render-work command; `test:browser` remains the deterministic pacing gate.
- Explicit non-auto rows remain diagnostic, as before.
- Do not change production renderer, shaders, renderer budgets, browser pacing code, or workflow ordering.

## TDD and verification

1. Add a focused behavior test first that demonstrates the GitHub-runner-shaped case: render p95 inside budget, frame p95/long-frame percentage outside budget. Existing assertion selection should RED; new render-work gate must accept it while retaining diagnostic failure.
2. Add cases proving auto render p95 overflow fails and explicit-backend overflow does not become an asserted row.
3. Implement the smallest helper/wiring in benchmark scripts or a dedicated testable module.
4. Run focused tests, full `npm test`, `npm run build`, `npm run benchmark:assert`, and `npm run test:browser`; diff-check and clean-tree verification.
5. Report exact RED/GREEN evidence and explain why no performance threshold was weakened. Commit scoped changes; no push.

Use `apply_patch` first. If the known Windows ACL helper fails, use only exact guarded PowerShell changes with immediate diff inspection and document the fallback.
