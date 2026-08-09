# Franz & Lola Pixel Renderer

Gemeinsamer, frameworkfreier Canvas-Renderer und Simulationskern für Spiel und Levelwerkstatt. Das Paket enthält das versionierte Zwischenformat, Normalisierung, Validierung, Wegerreichbarkeit, Kamera-Projektion, Pixel-Art-Painter und die bildfrequenzunabhängige Maze-Chase-Simulation.

Eigene, nicht feindliche Figuren leben getrennt von Katzen unter `actors.characters`. Sie besitzen stabile IDs, eine wiederverwendbare `characterId`, Namen, Player States, Sprite-Animationen, Effekte und Cutscene-Ziele wie `character:passauer-postler`. Der Renderer zeichnet sie in normalen Levels und in gesampelten Cutscenes, ohne sie als Gegner oder Schwierigkeitsfaktor zu zählen.

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
- freie Rastergröße, Tunnelzeilen und einzeln adressierbare Wandsegmente mit eigener Farbe, Muster, Deckkraft und Effektstapel
- Landmarken und vollständige Farbpaletten
- Franz & Lola, beliebig viele Katzen und Power-ups mit stabilen, eindeutigen Actor-IDs
- optionale Pixel-Sprites mit Palette, benannten Animationen und zeitbasierten Keyframes samt Dauer, Easing, Playback und Loop-Modus; das ältere FPS-/Frame-Format bleibt lesbar
- explizite Spielerzustände `idle`, `up`, `right`, `down` und `left`, die frei auf Sprite-Animationen abgebildet werden
- frei konfigurierbares Spieler- und Katzenverhalten (Steuerung, Jagdstrategie, Ziel, Tempo, Voraussicht und Zufall)
- Dekorationen wie Bäume, Bänke, Lampen, Schilder, Wasser oder freie Symbole mit Schwebe-, Puls-, Blink-, Dreh- und frei definierbarer Transform-Keyframe-Bewegung
- stapelbare Canvas2D-Effekte (`glitch`, `neon`, `hologram`, `echo`, `sparkle`) für Figuren, Objekte und Ereignissymbole
- animierbare Levelränder mit Wasserströmung, springenden Fischen, Booten, Blättern, Glühwürmchen, Nebel, Stadtlichtern, Vögeln, Dampf, Funken und Bühnenpuls
- stufenlos positionier- und skalierbare zweisprachige Textblöcke mit Größe, Ausrichtung, optional transparentem Hintergrund oder Rahmen und eigener Animation
- frei definierbare Ereignisse mit Triggerzonen, Richtungsfolgen oder Zeitpunkten, lokalisierten Standard-/Dialekttexten, Belohnungen und Sichtbarkeitsregeln
- eingebaute Pixel-Ereignissymbole für Eisvogel, Pfote und Kirchenglocke sowie beliebige Sprite-Objekte aus der gemeinsamen Bibliothek
- levelgebundene Intro-, Übergangs- und Outro-Cutscenes mit Kamera-, Figuren-, Objekt- und Dialogspuren
- Gutti-Seed, Zielwerte und vollständige Physikprofile pro Schwierigkeit
- optionale Herkunftsmetadaten für Kataloge

Das maschinenlesbare Schema liegt unter `schema/franz-lola-level.schema.json` und wird mit dem Paket ausgeliefert. `validateLevelDocument()` ergänzt semantische Prüfungen, die JSON Schema allein nicht abbildet: Erreichbarkeit, Objekte in Wänden, zu kleine begehbare Flächen und überstehende Elemente.

## Renderer-Vertrag

`render(snapshot, options)` arbeitet unabhängig von der Bildfrequenz und kann interpolierte Actor-Snapshots anzeigen. `cameraEnabled: false` verwendet eine unverzerrte Contain-/Letterbox-Projektion für Editoren; die Spielkamera folgt bei aktivierter Kamera dem Spieler. Neue immutable Levelobjekte werden auch bei gleicher ID zuverlässig übernommen.

### Canvas2D, WebGL 2 und WebGPU

Die Spiellogik und die Pixelwelt bleiben deterministisch in Canvas2D. Eine getrennte Präsentationsschicht kann das fertige Bild anschließend mit WebGL 2 (GLSL ES) oder WebGPU (WGSL) verarbeiten. Dadurch bleiben Level-JSON, Kollisionen, Editor und GitHub-Pages-Deployment unverändert statisch; nur Licht, Atmosphäre und Bildschirm-Feedback laufen optional auf der GPU.

`backend: 'auto'` ist der produktive Standard. Schwache Geräte erhalten direkt Canvas2D. Auf stärkeren Geräten misst ein kurzer Start-Probe die tatsächliche GPU-Leistung und aktiviert WebGPU oder WebGL 2 nur, wenn der Kandidat schnell genug ist. Nicht verfügbare APIs, Shaderfehler und langsame Software-GPUs fallen kontrolliert auf den kompatiblen Pfad zurück. `quality: 'auto'` begrenzt zusätzlich interne Auflösung und Device-Pixel-Ratio anhand von Speicher und CPU-Kernen.

```js
const renderer = await PassauPixelRenderer.create(canvas, {
  backend: 'auto',
  preferWebGPU: true,
  quality: 'auto',
  powerPreference: 'low-power',
});
```

Die Effektart wird aus `theme.edgeEffects` des Levels abgeleitet: Wasser erhält sanfte Strömung, Natur feine Lichtpunkte, Nebel atmosphärische Bewegung, Stadt und Industrie subtile Licht- beziehungsweise Hitzereize und die Zauberberg-Bühne einen chromatischen Bühnenpuls. Schnüffel-Power und Treffer bekommen kurzes Bildschirm-Feedback. `reducedMotion: true` stoppt die zeitbasierte Shaderbewegung, ohne Lesbarkeit oder Steuerung zu ändern. Texte und Editor-Markierungen werden nach dem Effekt scharf darübergelegt.

Für Diagnose und Vergleich können `canvas2d`, `webgl2` und `webgpu` explizit angefordert werden. Der tatsächlich verwendete Pfad steht in `renderer.rendererInfo().backend`; im Spiel ist er im Entwicklungsmodus zusätzlich über `?renderer=canvas2d`, `?renderer=webgl2` oder `?renderer=webgpu` wählbar.

### Performance-Benchmark

Der Browser-Benchmark rendert ein absichtlich dichtes 25×25-Level und vergleicht Canvas2D, WebGL 2 und die produktive Automatik. Das Mobile-Profil verwendet 360×740 Pixel und vierfache CPU-Drosselung. Gemessen werden Render-p50/p95/p99, Frame-p95, effektive FPS, lange Frames, Long Tasks und GPU-Uploadvolumen. Nur die Automatik ist ein Release-Gate, weil explizite Backends bewusst auch langsame Softwareimplementierungen sichtbar machen sollen.

```bash
npm run benchmark
npm run benchmark:assert
npm run benchmark -- --frames=300 --webgpu
```

Die aktuellen Budgets liegen bei Desktop-p95 ≤ 12 ms und Mobile-p95 ≤ 28 ms. So bleibt die Vergleichsbasis reproduzierbar, und eine spätere Optimierung kann gegen dieselben Szenarien gemessen werden.

`FixedStepLoop` und `LevelSimulation` sind der gemeinsame Gameplay-Vertrag. Die Simulation läuft mit festen 120 Updates pro Sekunde; Displays mit 60, 120 oder 175 Hz zeigen interpolierte Bilder, ohne Spieltempo, Kollisionen oder Richtungswechsel zu verändern.

`DirectionalSwipeInput` und `queuePlayerDirection()` bilden außerdem den gemeinsamen Eingabevertrag für Spiel und Editor-Testlauf: Wischen reagiert während der Geste, Gegenrichtungen kehren sofort um und Abzweigungen werden bis zum nächsten gültigen Rasterzentrum gepuffert, ohne die Figur zu versetzen.

Umgebungsdetails sind Teil desselben Renderers. Die animierte Zauberberg-Bühne enthält nur noch die bauliche Kulisse und zwei transparente Lichtkegel. Beschriftungen und Musiknoten sind normale, frei verschiebbare und löschbare Levelobjekte; dasselbe gilt für Ereignissymbole und die optional eingeblendeten Triggerzonen des Editors.

Textblöcke werden mit Pretext Unicode-sicher vorbereitet und vermessen. Ihre Glyphen entstehen nach der Pixelwelt direkt in der endgültigen Kameraauflösung; dadurch bleiben sie auch bei Retina-Displays, Kamerazoom und gebrochenen Objektkoordinaten scharf, ohne die Pixelgrafik weichzuzeichnen.

`drawActorPreview()` rendert Franz & Lola oder eine Katze in beliebige Vorschaurahmen. Die Funktion verwendet exakt dieselben Custom-Sprites, Player States, Animationszeiten und Fallback-Painter wie `PassauPixelRenderer`; Editoren müssen daher keine zweite Figuren-Darstellung nachbauen.

```js
drawActorPreview(context, actor, { left: 0, top: 0, width: 96, height: 96 }, {
  kind: 'player', state: 'right', animationId: 'right', elapsed: 0.35,
});
```

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
