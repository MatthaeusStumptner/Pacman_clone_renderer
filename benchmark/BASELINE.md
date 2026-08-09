# Render-Baseline

Stand: 9. August 2026 · Chromium Headless unter Windows · 120 Messframes nach 45 Warm-up-Frames.

Die Matrix simuliert neben dem Viewport auch CPU-Drosselung, Gerätespeicher und Kernzahl. Sie ist eine reproduzierbare Referenz für spätere Änderungen auf demselben Benchmark-Rechner. Der automatische Pfad ist das Release-Gate.

| Profil | Simulation | Automatisch gewählt | Render p95 | Frame p95 | FPS | Lange Frames | Budget |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Notebook | 1366×768 · 8 GB · 8 Kerne · CPU ×2 | WebGL 2 | 6,4 ms | 33,4 ms | 47,29 | 10,08 % | bestanden |
| Tablet | 820×1180 · 8 GB · 8 Kerne · CPU ×2 | WebGL 2 | 6,7 ms | 33,4 ms | 46,07 | 10,08 % | bestanden |
| Modernes Handy | 390×844 · 4 GB · 8 Kerne · CPU ×3 | WebGL 2 | 9,4 ms | 16,8 ms | 58,53 | 1,68 % | bestanden |
| Schwaches Handy | 360×740 · 2 GB · 4 Kerne · CPU ×6 | Canvas2D | 29,7 ms | 33,3 ms | 56,67 | 2,52 % | bestanden |

Die moderne Geräteklasse erhält damit bewusst den Shaderpfad. Erst das stark gedrosselte Zwei-GB-Profil fällt auf Canvas2D zurück. Gegenüber der ersten GPU-Baseline sank der sichtbare Textur-Upload durch native Pixelauflösung und Kamera-Cropping um ungefähr 88 Prozent; das gecachte Umgebungsbild entfernt zusätzlich den wiederholten CPU-Aufbau der statischen Levelwelt.

Produktiven Auto-Pfad prüfen:

```bash
npm run benchmark -- --frames=120 --auto-only --assert
```

Vollständigen Vergleich inklusive erzwungener Diagnosepfade messen:

```bash
npm run benchmark -- --frames=90 --assert
npm run benchmark -- --frames=90 --webgpu
```
