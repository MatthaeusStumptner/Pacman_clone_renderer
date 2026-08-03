# Franz & Lola Pixel Renderer

Gemeinsamer, frameworkfreier Canvas-Renderer für das Spiel und den Level-Editor. Das Paket enthält außerdem das versionierte Zwischenformat für Level, Validierung, Wegerreichbarkeit und die Kamera-Projektion.

```js
import { PassauPixelRenderer, parseLevelDocument } from '@franz-lola/pixel-renderer';

const renderer = new PassauPixelRenderer(document.querySelector('canvas'));
const result = parseLevelDocument(json);
if (result.ok) renderer.setLevel(result.value);
renderer.render({ player, cats, pellets, powerUps, elapsed });
```

## Level-Format

Ein Level ist reines JSON mit `kind: "franz-lola-level"` und `schemaVersion: 1`. Es enthält Metadaten, Passau-Koordinaten, Rastergröße, rechteckige Wandsegmente, Theme, Startpositionen und Power-ups. `validateLevelDocument()` prüft die Struktur sowie unerreichbare oder in Wänden liegende Figuren und Sammelobjekte.

Das Format ist unabhängig vom Spielzustand. Dadurch können Level im Editor gestaltet, als JSON exportiert und ohne Programmierkenntnisse in den Level-Katalog des Spiels übernommen werden.
