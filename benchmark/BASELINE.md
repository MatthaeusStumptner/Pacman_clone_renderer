# Render-Baseline

Stand: 9. August 2026 · Chromium Headless unter Windows · 90 Messframes nach 45 Warm-up-Frames.

Das Desktop-Profil läuft mit 1280×800 Pixeln ohne CPU-Drosselung. Das schwache Mobile-Profil läuft mit 360×740 Pixeln, `quality: performance` und vierfacher CPU-Drosselung. Die Zahlen sind kein Vergleich verschiedener Computer, sondern eine reproduzierbare Referenz für spätere Änderungen am selben Benchmark.

| Profil | Angefordert | Gewählt | Render p95 | Frame p95 | FPS | Lange Frames | Budget |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Desktop | Canvas2D | Canvas2D | 9,0 ms | 16,8 ms | 60,01 | 0 % | bestanden |
| Desktop | WebGL 2 | WebGL 2 | 16,1 ms | 33,4 ms | 35,60 | 25,84 % | Diagnose |
| Desktop | Auto | Canvas2D | 8,6 ms | 16,8 ms | 60,00 | 0 % | bestanden |
| Mobile · CPU ×4 | Canvas2D | Canvas2D | 22,3 ms | 33,4 ms | 48,99 | 8,99 % | bestanden |
| Mobile · CPU ×4 | WebGL 2 | WebGL 2 | 26,1 ms | 33,4 ms | 30,51 | 39,33 % | Diagnose |
| Mobile · CPU ×4 | Auto | Canvas2D | 18,3 ms | 33,4 ms | 51,35 | 7,87 % | bestanden |

Der Headless-Browser verwendet hier eine langsame Software-GPU. Das ist absichtlich ein wertvoller Negativfall: Der erzwungene WebGL-2-Pfad zeigt die Kosten des vollständigen Textur-Uploads, während `auto` den Kandidaten beim Start verwirft und das jeweilige Release-Budget einhält. Auf einem Gerät mit schneller Hardware-GPU kann die Startmessung stattdessen WebGPU oder WebGL 2 freigeben.

Neue Baseline messen:

```bash
npm run benchmark -- --frames=90 --assert
```

WebGPU-Verfügbarkeit und Fallback zusätzlich protokollieren:

```bash
npm run benchmark -- --frames=90 --webgpu
```
