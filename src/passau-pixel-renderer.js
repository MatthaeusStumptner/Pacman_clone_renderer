import { calculateCamera, projectWorldPoint, visibleWorldBounds } from './camera.js';
import { compileWallGrid, createLevelDocument } from './level-format.js';
import { drawCat, drawWalker } from './painters/characters.js';
import { drawCollectibles, drawEasterEggs } from './painters/collectibles.js';
import { drawEditorGrid, drawEnvironment } from './painters/environment.js';

const clampRatio = (value) => Math.min(2, Math.max(1, Number(value) || 1));
const interpolate = (entity, alpha) => ({ ...entity, x: Number.isFinite(entity.previousX) ? entity.previousX + (entity.x - entity.previousX) * alpha : entity.x, y: Number.isFinite(entity.previousY) ? entity.previousY + (entity.y - entity.previousY) * alpha : entity.y });

export class PassauPixelRenderer {
  constructor(canvas, { pixelRatio, zoom = 1.12 } = {}) {
    if (!canvas?.getContext) throw new TypeError('PassauPixelRenderer benötigt ein Canvas-Element.');
    this.canvas = canvas; this.context = canvas.getContext('2d'); this.document = canvas.ownerDocument ?? globalThis.document;
    this.scene = this.document.createElement('canvas'); this.sceneContext = this.scene.getContext('2d');
    this.pixelRatio = clampRatio(pixelRatio ?? globalThis.devicePixelRatio); this.zoom = zoom; this.level = null; this.grid = null;
  }

  setLevel(levelInput) {
    this.levelInput = levelInput;
    this.level = createLevelDocument(levelInput); this.grid = compileWallGrid(this.level);
    const width = this.level.board.columns * this.level.board.tileSize; const height = this.level.board.rows * this.level.board.tileSize;
    this.scene.width = width * 2; this.scene.height = height * 2; this.sceneContext.setTransform(2, 0, 0, 2, 0, 0); this.sceneContext.imageSmoothingEnabled = false;
    return this.level;
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect(); const ratio = clampRatio(globalThis.devicePixelRatio ?? this.pixelRatio);
    const width = Math.max(1, Math.round((bounds.width || this.canvas.clientWidth || 1) * ratio)); const height = Math.max(1, Math.round((bounds.height || this.canvas.clientHeight || 1) * ratio));
    if (this.canvas.width !== width) this.canvas.width = width; if (this.canvas.height !== height) this.canvas.height = height; this.pixelRatio = ratio;
    return { width: width / ratio, height: height / ratio, pixelRatio: ratio };
  }

  render(snapshot, options = {}) {
    const level = snapshot.level ? this.setLevelIfChanged(snapshot.level) : this.level;
    if (!level) throw new Error('Vor dem Rendern muss ein Level gesetzt sein.');
    const alpha = Math.min(1, Math.max(0, Number(options.alpha) || 0));
    const player = interpolate({ ...level.actors.player, ...(snapshot.player ?? {}) }, alpha);
    const cats = (snapshot.cats ?? level.actors.cats).map((cat, index) => interpolate({ ...(level.actors.cats[index] ?? {}), ...cat }, alpha)); const elapsed = Number(snapshot.elapsed) || 0;
    const worldWidth = level.board.columns * level.board.tileSize; const worldHeight = level.board.rows * level.board.tileSize; const scene = this.sceneContext;
    scene.clearRect(0, 0, worldWidth, worldHeight); drawEnvironment(scene, level, this.grid, elapsed); drawEasterEggs(scene, level, snapshot.easterEggs, elapsed);
    drawCollectibles(scene, { pellets: snapshot.pellets, powerUps: snapshot.powerUps }, level.board.tileSize, elapsed);
    cats.forEach((cat) => drawCat(scene, { ...cat, elapsed }, level.board.tileSize, { frightened: (snapshot.powerTimer ?? 0) > 0, frightenedTime: snapshot.powerTimer ?? 0 }));
    drawWalker(scene, player, level.board.tileSize, { elapsed, hitTimer: snapshot.hitTimer });
    if (options.editor?.showGrid) drawEditorGrid(scene, level);
    if (options.editor?.cursor) {
      const { x, y, width = 1, height = 1, color = 'rgba(245, 196, 81, 0.5)' } = options.editor.cursor;
      scene.fillStyle = color;
      scene.fillRect(x * level.board.tileSize + 2, y * level.board.tileSize + 2, width * level.board.tileSize - 4, height * level.board.tileSize - 4);
    }
    this.drawVignette(worldWidth, worldHeight);
    const display = this.resize(); const viewport = options.viewport ?? { x: 0, y: 0, width: display.width, height: display.height };
    const camera = calculateCamera({ worldWidth, worldHeight, viewport, target: { x: player.x * level.board.tileSize + level.board.tileSize / 2, y: player.y * level.board.tileSize + level.board.tileSize / 2 }, zoom: options.zoom ?? this.zoom, enabled: options.cameraEnabled !== false });
    this.present(camera); const tile = level.board.tileSize; const playerScreen = projectWorldPoint(camera, { x: player.x * tile + tile / 2, y: player.y * tile + tile / 2 }); const bounds = visibleWorldBounds(camera);
    const entities = cats.map((cat, index) => { const world = { x: cat.x * tile + tile / 2, y: cat.y * tile + tile / 2 }; return { id: cat.id ?? `cat-${index + 1}`, index, screen: projectWorldPoint(camera, world), onScreen: world.x >= bounds.left && world.x <= bounds.right && world.y >= bounds.top && world.y <= bounds.bottom, distance: Math.hypot(player.x - cat.x, player.y - cat.y), color: cat.color, respawnTimer: cat.respawnTimer ?? 0 }; });
    return { camera, playerScreen, entities, display };
  }

  setLevelIfChanged(levelInput) {
    if (this.levelInput === levelInput) return this.level;
    return this.setLevel(levelInput);
  }

  drawVignette(width, height) {
    const context = this.sceneContext; const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.32, width / 2, height / 2, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, 'rgba(2, 8, 12, 0)'); gradient.addColorStop(1, 'rgba(2, 8, 12, 0.28)'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  }

  present(camera) {
    const context = this.context; const { source, viewport } = camera; const ratio = this.pixelRatio;
    context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, this.canvas.width, this.canvas.height); context.imageSmoothingEnabled = false;
    context.drawImage(this.scene, source.x * 2, source.y * 2, source.width * 2, source.height * 2, viewport.x * ratio, viewport.y * ratio, viewport.width * ratio, viewport.height * ratio);
  }
}
