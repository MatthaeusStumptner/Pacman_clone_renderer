# Franz & Lola Pixel Renderer

Gemeinsamer, frameworkfreier Canvas-Renderer für Spiel und Levelwerkstatt. Das Paket enthält das versionierte Zwischenformat, Normalisierung, Validierung, Wegerreichbarkeit, Kamera-Projektion und Pixel-Art-Painter.

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
- optionale Pixel-Sprites mit Palette und 4×4 bis 24×24 Pixeln
- Dekorationen wie Bäume, Bänke, Lampen, Schilder, Wasser oder freie Symbole
- Gutti-Seed und Zielwerte pro Schwierigkeit
- optionale Herkunftsmetadaten für Kataloge

Das maschinenlesbare Schema liegt unter `schema/franz-lola-level.schema.json` und wird mit dem Paket ausgeliefert. `validateLevelDocument()` ergänzt semantische Prüfungen, die JSON Schema allein nicht abbildet: Erreichbarkeit, Objekte in Wänden, zu kleine begehbare Flächen und überstehende Elemente.

## Renderer-Vertrag

`render(snapshot, options)` arbeitet unabhängig von der Bildfrequenz und kann interpolierte Actor-Snapshots anzeigen. `cameraEnabled: false` verwendet eine unverzerrte Contain-/Letterbox-Projektion für Editoren; die Spielkamera folgt bei aktivierter Kamera dem Spieler. Neue immutable Levelobjekte werden auch bei gleicher ID zuverlässig übernommen.

```bash
npm install
npm test
npm run build
```
