# Franz & Lola Pixel Renderer

Gemeinsamer, frameworkfreier Canvas-Renderer und Simulationskern für Spiel und Levelwerkstatt. Das Paket enthält das versionierte Zwischenformat, Normalisierung, Validierung, Wegerreichbarkeit, Kamera-Projektion, Pixel-Art-Painter und die bildfrequenzunabhängige Maze-Chase-Simulation.

```js
import { PassauPixelRenderer, parseLevelDocument } from '@franz-lola/pixel-renderer';

const renderer = new PassauPixelRenderer(document.querySelector('canvas'));
const result = parseLevelDocument(json);
if (result.ok) renderer.setLevel(result.value);
renderer.render({ level: result.value, player, cats, pellets, powerUps, elapsed });
```

## Level-Format v1

Ein Level ist reines JSON mit `kind: "franz-lola-level"` und `schemaVersion: 1`. Unterstützt werden:

- lokalisierte Namen, Missionen und Beschreibungen
- Passau-Koordinaten und Gebietsangaben
- freie Rastergröße, Tunnelzeilen und rechteckige Wandsegmente
- Landmarken und vollständige Farbpaletten
- Franz & Lola, beliebig viele Katzen und Power-ups
- optionale Pixel-Sprites mit Palette, benannten Animationen, frei vielen Frames, FPS und Loop-Modus
- frei konfigurierbares Spieler- und Katzenverhalten (Steuerung, Jagdstrategie, Ziel, Tempo, Voraussicht und Zufall)
- Dekorationen wie Bäume, Bänke, Lampen, Schilder, Wasser oder freie Symbole mit Schwebe-, Puls-, Blink- und Drehbewegung
- Gutti-Seed, Zielwerte und vollständige Physikprofile pro Schwierigkeit
- optionale Herkunftsmetadaten für Kataloge

Das maschinenlesbare Schema liegt unter `schema/franz-lola-level.schema.json` und wird mit dem Paket ausgeliefert. `validateLevelDocument()` ergänzt semantische Prüfungen, die JSON Schema allein nicht abbildet: Erreichbarkeit, Objekte in Wänden, zu kleine begehbare Flächen und überstehende Elemente.

## Renderer-Vertrag

`render(snapshot, options)` arbeitet unabhängig von der Bildfrequenz und kann interpolierte Actor-Snapshots anzeigen. `cameraEnabled: false` verwendet eine unverzerrte Contain-/Letterbox-Projektion für Editoren; die Spielkamera folgt bei aktivierter Kamera dem Spieler. Neue immutable Levelobjekte werden auch bei gleicher ID zuverlässig übernommen.

`FixedStepLoop` und `LevelSimulation` sind der gemeinsame Gameplay-Vertrag. Die Simulation läuft mit festen 120 Updates pro Sekunde; Displays mit 60, 120 oder 175 Hz zeigen interpolierte Bilder, ohne Spieltempo, Kollisionen oder Richtungswechsel zu verändern.

```js
const simulation = new LevelSimulation(level, { difficulty: 'normal', pellets });
const loop = new FixedStepLoop({ updatesPerSecond: 120 });
loop.advance(performance.now(), (dt) => simulation.step(dt));
renderer.render(simulation.snapshot(), { alpha: loop.interpolationAlpha, cameraEnabled: true });
```

```bash
npm install
npm test
npm run build
```
