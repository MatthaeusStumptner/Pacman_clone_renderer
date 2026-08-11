# Renderer CI determinism — task report

## Root cause

`PassauPixelRenderer` defaults to `quality: 'auto'`. `resolveRendererQuality` chooses
`balanced` for a browser profile with `deviceMemory: 4` or `hardwareConcurrency: 4`,
which has a `pixelRatio` cap of `1.6`. Four tests in `test/renderer.test.js` instead
assert the intentional `quality` profile and its 2x DPR cap without selecting that
profile. GitHub Actions therefore observes correct renderer behaviour but the tests
fail on its lower-capability environment.

## Reproduction (RED)

The existing renderer test file was run with a Node `--import` setup that defines
`navigator.deviceMemory = 4` and `navigator.hardwareConcurrency = 4` before test
modules load. Result: 12 pass / 4 fail, exactly these tests:

- reuses externally measured display metrics without reading layout during render
- normalizes zero externally measured display metrics without reading client size
- normalizes non-finite externally measured dimensions before backend resize
- reports the requested backend, selected backend, and fallback reason

The failures report `balanced` / `1.6` where the fixtures assert `quality` / `2`.

## Scoped correction

Only the four fixtures above now explicitly pass `quality: 'quality'`. Production
renderer code and assertions are unchanged. This makes the fixtures declare the
profile their hard-coded expected values describe, while tests of automatic quality
selection remain independent elsewhere.

`apply_patch` was attempted first but blocked by the known Windows ACL helper error
(`apply deny-read ACLs`). A guarded PowerShell fallback required exactly one match for
each of the four full fixture prefixes before replacement, then ran `git diff --check`
immediately.

## Verification (GREEN)

- Simulated balanced-device focused test: `node --import <navigator setup> --test test/renderer.test.js` — 16/16 pass.
- Full suite: `npm test` — 99/99 pass.
- Production build: `npm run build` — exit 0.
- Whitespace: `git diff --check` — exit 0.

## Self-review

- Scope is exactly `test/renderer.test.js`; four option objects changed.
- No production file, snapshot refresh, or assertion weakening.
- Expected `quality` values remain strict and now correspond to explicit fixture input.
- Concern: None known. CI remains the final environment confirmation.