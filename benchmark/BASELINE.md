# Render-Baseline

Stand: 11. August 2026 · Playwright Chromium 151.0.7922.34 Headless unter Windows · Node.js 24.19.0 · 300 Messframes nach 45 Warm-up-Frames.

Die Matrix verwendet für jedes Szenario einen frischen Browserkontext und dieselben späten Konsolen-, Crash- und WebGL-Kontextverlust-Prüfungen wie `scripts/browser-regression.mjs`. Viewport, CPU-Drosselung, Gerätespeicher und Kernzahl werden pro Profil emuliert. Die Diagnosezähler sind kumulierte Werte nach insgesamt 345 Frames; Render-p95 enthält nur die 300 Messframes.

| Benchmark-URL | Umgebung / Profil / Qualität | Angefordert | Aufgelöst | Nativer Status / Fallbackgrund | Render p95 | Upload | Crop-Resizes | Textur-Neuanlagen | Budget |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `benchmark.html?backend=webgl2&profile=mobile&quality=balanced&frames=300` | 390×844 · CPU ×3 · 4 GB · 8 Kerne · `mobile` / `balanced` | WebGL 2 | WebGL 2 | nativ; kein Fallback | 6,4 ms | 234,6 MB | 1 | 3 | bestanden |
| `benchmark.html?backend=webgpu&profile=mobile&quality=balanced&frames=300` | 390×844 · CPU ×3 · 4 GB · 8 Kerne · `mobile` / `balanced` | WebGPU | WebGL 2 | Fallback; „WebGPU ist auf diesem Gerät nicht verfügbar.“ | 6,3 ms | 234,6 MB | 1 | 3 | bestanden |
| `benchmark.html?backend=canvas2d&profile=weak-mobile&quality=performance&frames=300` | 360×740 · CPU ×6 · 2 GB · 4 Kerne · `weak-mobile` / `performance` | Canvas2D | Canvas2D | nativ; kein Fallback | 8,2 ms | 0 MB | 0 | 0 | bestanden |

Der WebGPU-Eintrag ist bewusst kein Nachweis für natives WebGPU: `navigator.gpu` war im Headless-Browser vorhanden, aber es stand kein Adapter zur Verfügung. Der öffentliche Diagnosevertrag ist deshalb immer das Tripel aus angefordertem Backend, aufgelöstem Backend und `fallbackReason`; die bloße API-Sichtbarkeit genügt nicht.

## Einmaliger Startaufwand

Die transaktionale Auswahl initialisiert einen GPU-Kandidaten zuerst auf einem 1×1-Scratch-Canvas, zerstört dessen Ressourcen und initialisiert danach den sichtbaren Canvas. Dieser Schutz erzeugt einmalig eine zusätzliche Backend-Vorbereitung, aber keine zusätzliche Arbeit pro Frame.

Ein Chrome-DevTools-Browserlauf auf dem Profil `mobile` (390×844, CPU ×3, 4 GB, 8 Kerne) verglich `createWebGL2Backend()` direkt mit `createPresentationBackend({ backend: 'webgl2' })`. Nach zwei Warm-up-Paaren wurden acht Paare in wechselnder Reihenfolge mit `performance.now()` gemessen und jeder Kontext anschließend über `WEBGL_lose_context` freigegeben:

- direkte Initialisierung: Median 8,0 ms und ein WebGL2-Kontext
- transaktionale Initialisierung: Median 15,8 ms und zwei WebGL2-Kontexte
- Proxy für den einmaligen Scratch-Aufwand: 7,8 ms

Der Proxy umfasst die zusätzliche Backend-Erzeugung einschließlich Shader-Kompilierung in diesem Browserlauf. Er ist weder eine Core-Web-Vital noch Teil des eingeschwungenen Render-p95 in der Matrix.

## Start-/LCP-Trace

Ein Chrome-DevTools-Performance-Trace mit Reload derselben WebGL2-URL und demselben `mobile`-Profil meldete LCP 94 ms (TTFB 6 ms, Renderverzögerung 88 ms) und CLS 0,0542. Das LCP-Element war die lokale H1-Überschrift; CrUX-Felddaten waren für die lokale Seite nicht verfügbar. Der Trace wies außerdem eine maximale lokale kritische Request-Kette von 166 ms aus. FCP, INP und TBT wurden in diesem Trace nicht ausgewiesen und werden daher nicht abgeleitet.

Vollständige 300-Frame-Matrix inklusive WebGPU-Diagnosepfad erneut messen:

```bash
npm run benchmark -- --frames=300 --webgpu
```

Browserregressionen und ihre Screenshots/Videos prüfen:

```bash
npm run test:browser
```
