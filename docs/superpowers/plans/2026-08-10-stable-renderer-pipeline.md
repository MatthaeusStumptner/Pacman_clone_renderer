# Stable Renderer Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WebGL2 and WebGPU presentation pixel-stable on fractional-DPR mobile displays while eliminating unnecessary texture uploads and startup probes.

**Architecture:** Keep the Canvas2D-authored world and the existing WebGL2/WebGPU/Canvas2D backends. Add a texel-snapped camera, DPR-aware post-processing, caller-owned display metrics, explicit dirty upload flags, immutable WebGL2 texture storage, and deterministic backend diagnostics. Preserve the public renderer entry points used by the game and level editor.

**Tech Stack:** JavaScript ES modules, Canvas2D, WebGL2/GLSL ES 3.0, WebGPU/WGSL, Node.js 22 test runner, Vite 6, Playwright Chromium.

## Global Constraints

- Keep `PassauPixelRenderer.create(canvas, options)` and `new PassauPixelRenderer(canvas, options)` backward compatible.
- Keep the fixed simulation independent from presentation cadence.
- Preserve nearest-neighbour pixel-art sampling.
- Do not introduce a GPU tile or sprite batcher in this change.
- Canvas2D remains the final fallback.
- Reduced motion disables geometric post-process movement.
- New production behavior must be introduced by a failing automated test first.

---

### Task 1: Texel-snapped camera contract

**Files:**
- Modify: `src/camera.js`
- Modify: `src/index.js`
- Modify: `src/passau-pixel-renderer.js`
- Test: `test/camera.test.js`

**Interfaces:**
- Consumes: `calculateCamera({ worldWidth, worldHeight, viewport, target, zoom, enabled })`.
- Produces: `snapCameraToTexels(camera, sceneScale, worldWidth, worldHeight)` returning a camera whose source origin is aligned to `1 / sceneScale` world units and remains clamped to the supplied world bounds.

- [ ] **Step 1: Add failing snapping tests**

```js
import { calculateCamera, projectWorldPoint, snapCameraToTexels } from '../src/index.js';

test('snaps camera origins to the authored texel grid', () => {
  const camera = calculateCamera({
    worldWidth: 600,
    worldHeight: 600,
    viewport: { x: 0, y: 203.2, width: 412, height: 711.8 },
    target: { x: 311.37, y: 287.61 },
    zoom: 1.12,
  });
  const native = snapCameraToTexels(camera, 1, 600, 600);
  const supersampled = snapCameraToTexels(camera, 2, 600, 600);
  assert.equal(native.source.x, Math.round(native.source.x));
  assert.equal(native.source.y, Math.round(native.source.y));
  assert.equal(supersampled.source.x * 2, Math.round(supersampled.source.x * 2));
  assert.equal(supersampled.source.y * 2, Math.round(supersampled.source.y * 2));
});

test('keeps snapped cameras inside the world at every edge', () => {
  const camera = calculateCamera({ worldWidth: 600, worldHeight: 600, viewport: { x: 0, y: 0, width: 390, height: 844 }, target: { x: 599.9, y: 599.9 }, zoom: 1.12 });
  const snapped = snapCameraToTexels(camera, 1, 600, 600);
  assert.ok(snapped.source.x >= 0);
  assert.ok(snapped.source.y >= 0);
  assert.ok(snapped.source.x + snapped.source.width <= 600);
  assert.ok(snapped.source.y + snapped.source.height <= 600);
});
```

- [ ] **Step 2: Run the camera tests and verify RED**

Run: `node --test test/camera.test.js`

Expected: failure because `snapCameraToTexels` is not exported.

- [ ] **Step 3: Implement the snapping helper**

```js
export function snapCameraToTexels(camera, sceneScale = 1, worldWidth, worldHeight) {
  const scale = positive(sceneScale, 1);
  const step = 1 / scale;
  const maximumX = positive(worldWidth, camera.source.width);
  const maximumY = positive(worldHeight, camera.source.height);
  const snappedX = clamp(Math.round(camera.source.x / step) * step, 0, maximumX - camera.source.width);
  const snappedY = clamp(Math.round(camera.source.y / step) * step, 0, maximumY - camera.source.height);
  return { ...camera, source: { ...camera.source, x: snappedX, y: snappedY } };
}
```

Export the helper from `src/index.js`. In `PassauPixelRenderer.render()`, call it immediately after `calculateCamera()` with the current level world width and height, then use the returned camera for presentation, text projection, editor selection, radar metadata, and the return value.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test test/camera.test.js && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/camera.js src/index.js src/passau-pixel-renderer.js test/camera.test.js
git commit -m "Stabilize camera sampling on pixel grids"
```

### Task 2: DPR-aware stable shader effects

**Files:**
- Modify: `src/gpu/effect-profile.js`
- Modify: `src/gpu/shaders.js`
- Modify: `src/gpu/webgl2-backend.js`
- Modify: `src/gpu/webgpu-backend.js`
- Modify: `src/passau-pixel-renderer.js`
- Test: `test/gpu-effects.test.js`

**Interfaces:**
- Consumes: `resolvePostProcessProfile(level, snapshot, options)`.
- Produces: profile fields `scanlinePeriod`, `scanlines`, and `rgbSplitTexels`; `options.actualPixelRatio` and `options.effectivePixelRatio` determine whether scanlines are safe.
- Produces: `rendererInfo().postProcess` with `scanlines`, `scanlinePeriod`, and `rgbSplitTexels` from the most recently presented frame.

- [ ] **Step 1: Add failing DPR and shader-source tests**

```js
test('disables scanlines when browser resampling can create moire', () => {
  const level = { id: 'home', theme: { edgeEffects: [] } };
  for (const actualPixelRatio of [1.25, 1.5, 1.6, 2.625, 3]) {
    const profile = resolvePostProcessProfile(level, {}, {
      quality: 'quality',
      actualPixelRatio,
      effectivePixelRatio: Math.min(2, actualPixelRatio),
    });
    assert.equal(profile.scanlines, 0);
  }
  const integer = resolvePostProcessProfile(level, {}, { quality: 'quality', actualPixelRatio: 2, effectivePixelRatio: 2 });
  assert.ok(integer.scanlines > 0);
  assert.ok(integer.scanlinePeriod >= 4);
});

test('keeps scene geometry stable in both GPU shaders', () => {
  assert.doesNotMatch(WEBGL_FRAGMENT_SHADER, /effect_uv|uv\.x \+=|uv\.y \+=/);
  assert.doesNotMatch(WEBGPU_SHADER, /effectUv|uv\.x \+=|uv\.y \+=/);
  assert.match(WEBGL_FRAGMENT_SHADER, /rgb_split_texels/);
  assert.match(WEBGPU_SHADER, /rgbSplitTexels/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/gpu-effects.test.js`

Expected: assertions fail because the profile lacks the new fields and both shaders still distort UVs.

- [ ] **Step 3: Make effect profiles DPR-aware**

Add this decision to `resolvePostProcessProfile()`:

```js
const actualPixelRatio = Math.max(1, Number(options.actualPixelRatio) || 1);
const effectivePixelRatio = Math.max(1, Number(options.effectivePixelRatio) || actualPixelRatio);
const integerOutput = Math.abs(actualPixelRatio - Math.round(actualPixelRatio)) < 0.001;
const nativeOutput = Math.abs(actualPixelRatio - effectivePixelRatio) < 0.001;
const stableScanlines = integerOutput && nativeOutput && !reducedMotion;
```

Return:

```js
scanlines: stableScanlines ? (quality === 'quality' ? 0.055 : 0.035) : 0,
scanlinePeriod: 4,
rgbSplitTexels: mode === 'stage' && !reducedMotion ? Math.max(0, Math.round(intensity * 2)) : 0,
```

- [ ] **Step 4: Replace global UV distortion with stable sampling**

In GLSL, sample the base color directly from `v_uv`, compute stage channel offsets with whole scene texels, and use a four-pixel scanline period:

```glsl
vec2 scene_uv = u_source.xy + v_uv * u_source.zw;
vec4 color = texture(u_scene, scene_uv);
vec2 texel = 1.0 / max(u_scene_size, vec2(1.0));
float rgb_split_texels = u_sampling.y;
if (rgb_split_texels > 0.0) {
  vec2 shift = vec2(rgb_split_texels, 0.0) * texel;
  color.r = texture(u_scene, clamp(scene_uv + shift, u_source.xy, u_source.xy + u_source.zw)).r;
  color.b = texture(u_scene, clamp(scene_uv - shift, u_source.xy, u_source.xy + u_source.zw)).b;
}
float scanline = step(0.75, fract((gl_FragCoord.y - 0.5) / max(4.0, u_sampling.x)));
color.rgb *= 1.0 - scanline * u_feedback.w;
```

Implement the identical sampling math in WGSL using `uniforms.canvasSceneSize.zw` for scene dimensions. Keep fog, sparkle, tint, vignette, power, hit, world overlay, and screen overlay color composition. Remove `effect_uv()` and `effectUv()`.

- [ ] **Step 5: Wire the new uniforms**

Add GLSL uniforms `u_scene_size` and `u_sampling`. Upload `u_sampling = vec2(profile.scanlinePeriod, profile.rgbSplitTexels)` and keep feedback W for `profile.scanlines`.

Extend WGSL `Uniforms` with `sampling: vec4f` and increase `UNIFORM_FLOATS` from 24 to 28. Keep `canvasSceneSize` as `(canvasWidth, canvasHeight, sceneWidth, sceneHeight)` and write `sampling` as `(scanlinePeriod, rgbSplitTexels, 0, 0)` at float offsets 24–27.

Store the resolved profile as `this.lastPostProcessProfile` before presentation and expose this immutable diagnostic subset:

```js
postProcess: this.lastPostProcessProfile ? {
  scanlines: this.lastPostProcessProfile.scanlines,
  scanlinePeriod: this.lastPostProcessProfile.scanlinePeriod,
  rgbSplitTexels: this.lastPostProcessProfile.rgbSplitTexels,
} : null,
```

Pass `actualPixelRatio: globalThis.devicePixelRatio` and `effectivePixelRatio: this.pixelRatio` from `PassauPixelRenderer.render()`.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test test/gpu-effects.test.js && npm test`

Expected: all tests pass and both shader source checks confirm stable scene UVs.

- [ ] **Step 7: Commit**

```powershell
git add src/gpu/effect-profile.js src/gpu/shaders.js src/gpu/webgl2-backend.js src/gpu/webgpu-backend.js src/passau-pixel-renderer.js test/gpu-effects.test.js
git commit -m "Remove fractional shader shimmer"
```

### Task 3: Caller-owned resize metrics

**Files:**
- Modify: `src/passau-pixel-renderer.js`
- Modify: `src/gpu/canvas2d-backend.js`
- Modify: `src/gpu/webgl2-backend.js`
- Modify: `src/gpu/webgpu-backend.js`
- Test: `test/renderer.test.js`

**Interfaces:**
- Produces: `renderer.resize({ width, height, devicePixelRatio, reason })` returning `{ width, height, pixelRatio, bufferWidth, bufferHeight, changed, reason }`.
- Compatibility: `renderer.resize()` measures the canvas once for legacy callers; `render()` reuses the cached metrics and does not call `getBoundingClientRect()`.

- [ ] **Step 1: Add failing renderer resize tests**

```js
test('reuses externally measured display metrics without reading layout during render', () => {
  let layoutReads = 0;
  const canvas = fakeCanvas({ width: 412, height: 712, onLayoutRead: () => { layoutReads += 1; } });
  const renderer = new PassauPixelRenderer(canvas, { presentationBackend: fakePresentationBackend() });
  renderer.resize({ width: 412, height: 712, devicePixelRatio: 2.625, reason: 'observer' });
  const readsAfterResize = layoutReads;
  renderer.setLevel(sampleLevel());
  renderer.render(sampleSnapshot(), { cameraEnabled: true });
  assert.equal(layoutReads, readsAfterResize);
  assert.deepEqual(renderer.rendererInfo().display, {
    width: 412, height: 712, actualPixelRatio: 2.625, pixelRatio: 2,
    bufferWidth: 824, bufferHeight: 1424, reason: 'observer',
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/renderer.test.js`

Expected: render performs an additional layout read and no display diagnostics exist.

- [ ] **Step 3: Implement cached display metrics**

Initialize:

```js
this.displayMetrics = null;
```

Replace `resize()` with an optional metrics contract. Normalize CSS width and height to positive numbers, clamp the effective ratio with `pixelRatioLimit`, calculate integer backbuffer dimensions, and call backend `resize()` only when they change. In `render()`, use `this.displayMetrics ?? this.resize()`.

Expose this shape in `rendererInfo()`:

```js
display: this.displayMetrics ? {
  width: this.displayMetrics.width,
  height: this.displayMetrics.height,
  actualPixelRatio: this.displayMetrics.actualPixelRatio,
  pixelRatio: this.displayMetrics.pixelRatio,
  bufferWidth: this.displayMetrics.bufferWidth,
  bufferHeight: this.displayMetrics.bufferHeight,
  reason: this.displayMetrics.reason,
} : null,
```

- [ ] **Step 4: Verify unchanged resize calls do not touch backends**

Extend the fake backend with a `resizeCalls` counter and assert that identical external metrics leave it at one call while a changed height increments it to two.

Run: `node --test test/renderer.test.js`

Expected: all renderer tests pass.

- [ ] **Step 5: Run full tests and commit**

Run: `npm test`

```powershell
git add src/passau-pixel-renderer.js src/gpu/canvas2d-backend.js src/gpu/webgl2-backend.js src/gpu/webgpu-backend.js test/renderer.test.js
git commit -m "Cache renderer display measurements"
```

### Task 4: Dirty texture uploads and immutable WebGL storage

**Files:**
- Modify: `src/gpu/webgl2-backend.js`
- Modify: `src/gpu/webgpu-backend.js`
- Modify: `src/passau-pixel-renderer.js`
- Test: `test/renderer.test.js`
- Create: `test/gpu-upload-contract.test.js`

**Interfaces:**
- Consumes: backend `present({ sceneChanged, overlayChanged, worldOverlayChanged, ... })`.
- Produces: counters `sceneUploadSkips`, `overlayUploadSkips`, `worldOverlayUploadSkips`; renderer option `sceneChanged` defaults to `true`.
- Produces: renderer option `staticRevision`; the retained environment, non-animated decorations, and pellets rebuild only when this revision, level, or language changes.
- Produces: renderer diagnostic counter `staticWorldBuilds`.

- [ ] **Step 1: Add failing upload contract tests**

Create a fake WebGL2 context that records `texStorage2D`, `texSubImage2D`, and `deleteTexture`, then assert:

```js
test('allocates WebGL2 textures immutably and skips clean scene uploads', () => {
  const { gl, calls } = recordingWebGL2Context();
  const backend = new WebGL2PresentationBackend(fakeCanvas(), gl);
  const frame = presentationFrame();
  backend.present({ ...frame, sceneChanged: true });
  backend.present({ ...frame, sceneChanged: false, overlayChanged: false, worldOverlayChanged: false });
  assert.equal(calls.texStorage2D, 3);
  assert.equal(backend.snapshot().sceneUploadSkips, 1);
  assert.equal(backend.snapshot().uploadedBytes, frame.scene.width * frame.scene.height * 4);
});
```

Add an equivalent WebGPU test with a recording queue and assert the second frame does not call `copyExternalImageToTexture`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/gpu-upload-contract.test.js`

Expected: missing exported backend constructor or missing `sceneUploadSkips` and `texStorage2D` calls.

- [ ] **Step 3: Implement immutable WebGL2 texture records**

When a texture size changes, delete its old texture, create and bind a replacement, then allocate one mip level:

```js
gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
record.width = width;
record.height = height;
record.uploaded = false;
```

Only call `texSubImage2D` when `changed || !record.uploaded`. Track scene skips independently from the existing overlay counters.

- [ ] **Step 4: Implement the same dirty contract for WebGPU**

Guard the scene copy:

```js
let sceneBytes = 0;
if (sceneChanged || !this.sceneTexture.uploaded) {
  this.device.queue.copyExternalImageToTexture({ source: scene }, { texture: this.sceneTexture.texture }, [scene.width, scene.height]);
  this.sceneTexture.uploaded = true;
  sceneBytes = scene.width * scene.height * 4;
} else {
  this.sceneUploadSkips += 1;
}
```

Reset `uploaded` after texture recreation and context recovery.

- [ ] **Step 5: Wire renderer dirty markers and retain the static world**

Pass `sceneChanged: options.sceneChanged !== false` from `PassauPixelRenderer.render()` through `present()`. Preserve default behavior for editor callers that do not supply the flag.


Create `this.staticWorld` and `this.staticWorldContext` alongside `environment`. Size them in `setLevel()`. Rebuild the static world when this key changes:

```js
const staticKey = `${level.id}|${options.staticRevision ?? 'legacy'}|${renderLanguage}`;
```

The rebuild clears the layer, copies `environment`, draws decorations whose type is not `text`, whose animation type is missing or `none`, and whose effects array is empty, then draws pellets with elapsed `0`. Increment `staticWorldBuilds` after a rebuild.

Every frame copies `staticWorld` into `scene`, then draws animated decorations, power-ups, every active or inactive event visual, cats, authored characters, and the player. For callers without `staticRevision`, retain legacy correctness by rebuilding whenever pellet Set identity or size, decoration array identity, level, or language changes.

Extend `test/renderer.test.js`:

```js
test('reuses the retained static world until its revision changes', () => {
  const renderer = createTestRenderer();
  renderer.setLevel(sampleLevel());
  renderer.render(sampleSnapshot(), { staticRevision: 4 });
  renderer.render(sampleSnapshot(), { staticRevision: 4 });
  assert.equal(renderer.rendererInfo().staticWorldBuilds, 1);
  renderer.render(sampleSnapshot(), { staticRevision: 5 });
  assert.equal(renderer.rendererInfo().staticWorldBuilds, 2);
});
```

- [ ] **Step 6: Run tests and benchmark assertion**

Run: `node --test test/gpu-upload-contract.test.js test/renderer.test.js && npm test && npm run benchmark:assert`

Expected: all tests and budgets pass.

- [ ] **Step 7: Commit**

```powershell
git add src/gpu/webgl2-backend.js src/gpu/webgpu-backend.js src/passau-pixel-renderer.js test/renderer.test.js test/gpu-upload-contract.test.js
git commit -m "Skip clean GPU texture uploads"
```

### Task 5: Deterministic backend selection and diagnostics

**Files:**
- Modify: `src/gpu/presentation-backend.js`
- Modify: `src/gpu/webgpu-backend.js`
- Modify: `src/gpu/webgl2-backend.js`
- Test: `test/renderer.test.js`
- Create: `test/backend-selection.test.js`

**Interfaces:**
- Produces: `createPresentationBackend(canvas, options)` tries WebGPU, WebGL2, Canvas2D without synthetic frames.
- Produces: snapshot fields `requestedBackend`, `backend`, and `fallbackReason`.
- Produces: `webGPUAdapterOptions(options, environment)` omitting `powerPreference` on Windows.

- [ ] **Step 1: Add failing selection tests**

```js
test('omits ignored WebGPU power preference on Windows', () => {
  assert.deepEqual(webGPUAdapterOptions({ powerPreference: 'high-performance' }, { userAgentData: { platform: 'Windows' } }), {});
  assert.deepEqual(webGPUAdapterOptions({ powerPreference: 'high-performance' }, { userAgentData: { platform: 'Android' } }), { powerPreference: 'high-performance' });
});

test('selects backends by capability without rendering probe frames', async () => {
  const calls = [];
  const backend = await selectPresentationBackend('auto', {
    webgpu: async () => { calls.push('webgpu'); throw new Error('adapter unavailable'); },
    webgl2: () => { calls.push('webgl2'); return { kind: 'webgl2' }; },
    canvas2d: () => { calls.push('canvas2d'); return { kind: 'canvas2d' }; },
  });
  assert.equal(backend.kind, 'webgl2');
  assert.deepEqual(calls, ['webgpu', 'webgl2']);
  assert.match(backend.fallbackReason, /adapter unavailable/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/backend-selection.test.js`

Expected: the helper exports do not exist.

- [ ] **Step 3: Remove `probeResources()` and `probeCandidate()`**

Implement `selectPresentationBackend()` as a small dependency-injected selector used by `createPresentationBackend()`. Explicit `webgpu` and `webgl2` with `fallback: false` still throw their initialization error. Auto mode stores the first failure message on the selected fallback backend.

- [ ] **Step 4: Add platform-safe adapter options**

```js
export function webGPUAdapterOptions(options = {}, environment = globalThis.navigator) {
  const platform = environment?.userAgentData?.platform ?? environment?.platform ?? '';
  if (/windows/i.test(platform)) return {};
  return options.powerPreference ? { powerPreference: options.powerPreference } : {};
}
```

Use it in `initializeWebGPU()`. Include `requestedBackend` and `fallbackReason` in every backend snapshot.

- [ ] **Step 5: Run tests and commit**

Run: `node --test test/backend-selection.test.js test/renderer.test.js && npm test`

```powershell
git add src/gpu/presentation-backend.js src/gpu/webgpu-backend.js src/gpu/webgl2-backend.js test/backend-selection.test.js test/renderer.test.js
git commit -m "Make renderer fallback deterministic"
```

### Task 6: Automated fractional-DPR browser regression

**Files:**
- Modify: `benchmark.html`
- Modify: `benchmark/main.js`
- Create: `scripts/browser-regression.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run test:browser` launching a temporary Vite server and Chromium.
- Produces: artifacts under `output/playwright/renderer/` locally; CI uploads them only on failure.

- [ ] **Step 1: Add a browser test that fails on the old shader**

The script must launch Chromium, open `benchmark.html?backend=webgl2&quality=quality&frames=180`, emulate 412 × 915 at DPR 2.625, await `window.__RENDER_BENCHMARK__`, and evaluate:

```js
const result = await page.evaluate(() => ({
  renderer: document.querySelector('#benchmark').dataset.rendererBackend,
  pixelRatio: devicePixelRatio,
  shaderScanlines: window.__RENDER_BENCHMARK_RESULT__?.postProcess?.scanlines,
}));
assert.equal(result.pixelRatio, 2.625);
assert.equal(result.shaderScanlines, 0);

```

Create a second browser context with `reducedMotion: 'reduce'` and assert both `postProcess.scanlines === 0` and `postProcess.rgbSplitTexels === 0`. In a desktop context, instantiate `PresentationFramePacer` in the page and feed timestamp sequences for 60, 120, and 175 Hz over two virtual seconds; assert no sequence presents more than 121 frames.

Capture WebGL2 and Canvas2D screenshots and record a two-second WebM while the camera moves. When `navigator.gpu` is available, run and capture the same case with WebGPU; otherwise record the renderer fallback reason as an explicit skip. Expose `__RENDER_BENCHMARK_RESULT__` from `benchmark/main.js` with profile and renderer diagnostics.

- [ ] **Step 2: Run and verify RED**

Run: `node scripts/browser-regression.mjs`

Expected: failure because the benchmark result does not expose the profile and fractional-DPR scanlines remain active.

- [ ] **Step 3: Complete the deterministic browser harness**

Use Playwright's installed `chromium`, `createServer` from Vite, a random available localhost port, and `recordVideo: { dir: 'output/playwright/renderer' }`. Always close page, browser, and Vite server in `finally`.

Add scripts:

```json
"test:browser": "node scripts/browser-regression.mjs",
"verify": "npm test && npm run build && npm run benchmark:assert && npm run test:browser"
```

Ignore `output/playwright/`. Extend CI with `npx playwright install --with-deps chromium`, `npm run benchmark:assert`, and `npm run test:browser`.

- [ ] **Step 4: Run browser regression twice**

Run: `npm run test:browser && npm run test:browser`

Expected: both runs pass without a port leak, and WebGL2/Canvas2D screenshots plus WebM files are created.

- [ ] **Step 5: Run full verification and commit**

Run: `npm run verify`

```powershell
git add benchmark.html benchmark/main.js scripts/browser-regression.mjs package.json package-lock.json .github/workflows/ci.yml .gitignore
git commit -m "Test renderer stability at fractional DPR"
```

### Task 7: Final renderer measurements and PR update

**Files:**
- Modify: `README.md`
- Modify: `benchmark/BASELINE.md`

**Interfaces:**
- Consumes: all renderer diagnostics and browser artifacts from Tasks 1–6.
- Produces: documented public resize/dirty contract and measured upload/frame baseline.

- [ ] **Step 1: Run fresh verification**

Run: `npm ci && npm run verify`

Expected: unit tests, build, benchmark budgets, and browser regressions pass with exit code 0.

- [ ] **Step 2: Measure each backend**

Run these benchmark URLs through `scripts/browser-regression.mjs` and write the measured resolved backend, p95 render time, uploaded megabytes, crop resizes, and texture reallocations into `benchmark/BASELINE.md`:

```text
benchmark.html?backend=webgl2&profile=mobile&quality=balanced&frames=300
benchmark.html?backend=webgpu&profile=mobile&quality=balanced&frames=300
benchmark.html?backend=canvas2d&profile=weak-mobile&quality=performance&frames=300
```

- [ ] **Step 3: Document the API**

Add exact examples to `README.md`:

```js
renderer.resize({ width: 412, height: 712, devicePixelRatio: 2.625, reason: 'resize-observer' });
renderer.render(snapshot, { viewport: { x: 0, y: 0, width: 412, height: 712 }, sceneChanged: true });
```

Explain that static callers pass `sceneChanged: false`, and that fractional or downscaled DPR disables scanlines.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md benchmark/BASELINE.md
git commit -m "Document stable renderer performance contract"
```

- [ ] **Step 5: Verify branch diff**

Run: `git diff --check main...HEAD && git status -sb && npm run verify`

Expected: clean diff, clean worktree, and successful verification before updating Renderer PR #14.
