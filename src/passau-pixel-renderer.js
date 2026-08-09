import { calculateCamera, projectWorldPoint, visibleWorldBounds } from './camera.js';
import { compileWallGrid, createLevelDocument } from './level-format.js';
import { drawCat, drawWalker } from './painters/characters.js';
import { drawCollectibles, drawEasterEggs } from './painters/collectibles.js';
import { drawDecoration, drawEditorGrid, drawEnvironment } from './painters/environment.js';
import { drawWithVisualEffects } from './visual-effects.js';
import { resolvePostProcessProfile, resolveRendererQuality, rendererPixelRatioLimit } from './gpu/effect-profile.js';
import { createPresentationBackend, createSyncPresentationBackend } from './gpu/presentation-backend.js';

const clampRatio = (value, maximum = 2) => Math.min(maximum, Math.max(1, Number(value) || 1));
const interpolate = (entity, alpha) => ({ ...entity, x: Number.isFinite(entity.previousX) ? entity.previousX + (entity.x - entity.previousX) * alpha : entity.x, y: Number.isFinite(entity.previousY) ? entity.previousY + (entity.y - entity.previousY) * alpha : entity.y });

export class PassauPixelRenderer {
  static async create(canvas, options = {}) {
    const presentationBackend = await createPresentationBackend(canvas, options);
    return new PassauPixelRenderer(canvas, { ...options, presentationBackend });
  }

  constructor(canvas, { pixelRatio, zoom = 1.12, presentationBackend, quality = 'auto', ...backendOptions } = {}) {
    if (!canvas?.getContext) throw new TypeError('PassauPixelRenderer benötigt ein Canvas-Element.');
    this.canvas = canvas; this.document = canvas.ownerDocument ?? globalThis.document;
    this.quality = resolveRendererQuality(quality); this.pixelRatioLimit = rendererPixelRatioLimit(this.quality);
    this.presentation = presentationBackend ?? createSyncPresentationBackend(canvas, { ...backendOptions, quality });
    // The pixel world is already authored at native pixel resolution. GPU
    // backends upscale it with nearest-neighbour sampling, avoiding a 4x texture
    // upload while the Canvas2D fallback keeps its historical supersampling.
    this.sceneScale = this.presentation.kind === 'canvas2d'
      ? (this.quality === 'performance' ? 1 : this.quality === 'balanced' ? 1.5 : 2)
      : 1;
    this.scene = this.document.createElement('canvas'); this.sceneContext = this.scene.getContext('2d');
    this.environment = this.document.createElement('canvas'); this.environmentContext = this.environment.getContext('2d');
    this.environmentCache = { board: null, theme: null, decorations: null, language: '', frame: -1 };
    this.gpuScene = this.presentation.kind === 'canvas2d' ? null : this.document.createElement('canvas');
    this.gpuSceneContext = this.gpuScene?.getContext('2d') ?? null;
    this.overlay = this.document.createElement('canvas'); this.overlayContext = this.overlay.getContext('2d');
    this.context = this.overlayContext;
    this.pixelRatio = clampRatio(pixelRatio ?? globalThis.devicePixelRatio, this.pixelRatioLimit); this.zoom = zoom; this.level = null; this.grid = null;
  }

  setLevel(levelInput) {
    this.levelInput = levelInput;
    this.level = createLevelDocument(levelInput); this.grid = compileWallGrid(this.level);
    const width = this.level.board.columns * this.level.board.tileSize; const height = this.level.board.rows * this.level.board.tileSize;
    this.scene.width = Math.round(width * this.sceneScale); this.scene.height = Math.round(height * this.sceneScale); this.sceneContext.setTransform(this.sceneScale, 0, 0, this.sceneScale, 0, 0); this.sceneContext.imageSmoothingEnabled = false;
    this.environment.width = this.scene.width; this.environment.height = this.scene.height; this.environmentContext.setTransform(this.sceneScale, 0, 0, this.sceneScale, 0, 0); this.environmentContext.imageSmoothingEnabled = false;
    this.environmentCache = { board: null, theme: null, decorations: null, language: '', frame: -1 };
    return this.level;
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect(); const ratio = clampRatio(globalThis.devicePixelRatio ?? this.pixelRatio, this.pixelRatioLimit);
    const width = Math.max(1, Math.round((bounds.width || this.canvas.clientWidth || 1) * ratio)); const height = Math.max(1, Math.round((bounds.height || this.canvas.clientHeight || 1) * ratio));
    this.presentation.resize(width, height);
    if (this.overlay.width !== width) this.overlay.width = width; if (this.overlay.height !== height) this.overlay.height = height; this.pixelRatio = ratio;
    return { width: width / ratio, height: height / ratio, pixelRatio: ratio };
  }

  render(snapshot, options = {}) {
    const level = snapshot.level ? this.setLevelIfChanged(snapshot.level) : this.level;
    if (!level) throw new Error('Vor dem Rendern muss ein Level gesetzt sein.');
    const alpha = Math.min(1, Math.max(0, Number(options.alpha) || 0));
    const player = interpolate({ ...level.actors.player, ...(snapshot.player ?? {}) }, alpha);
    const cats = (snapshot.cats ?? level.actors.cats).map((cat, index) => interpolate({ ...(level.actors.cats[index] ?? {}), ...cat }, alpha)); const elapsed = Number(snapshot.elapsed) || 0;
    const characters = (snapshot.characters ?? level.actors.characters ?? []).map((character, index) => interpolate({ ...(level.actors.characters?.[index] ?? {}), ...character }, alpha));
    const renderLevel = snapshot.decorations ? { ...level, decorations: snapshot.decorations } : level;
    const worldWidth = level.board.columns * level.board.tileSize; const worldHeight = level.board.rows * level.board.tileSize; const scene = this.sceneContext;
    scene.clearRect(0, 0, worldWidth, worldHeight);
    this.prepareEnvironment(renderLevel, elapsed, options.language ?? 'standard');
    scene.save(); scene.setTransform(1, 0, 0, 1, 0, 0); scene.drawImage(this.environment, 0, 0); scene.restore();
    drawEasterEggs(scene, renderLevel, snapshot.levelEvents ?? (level.events?.length ? { unlocked: snapshot.unlockedEvents, active: snapshot.activeEventId, showAll: Boolean(options.editor?.showEvents), showZones: Boolean(options.editor?.showEventZones) } : snapshot.easterEggs), elapsed);
    drawCollectibles(scene, { pellets: snapshot.pellets, powerUps: snapshot.powerUps }, level.board.tileSize, elapsed);
    cats.forEach((cat) => {
      if ((cat.respawnTimer ?? 0) > 0) return;
      drawWithVisualEffects(scene, cat.effects, { left: cat.x * level.board.tileSize, top: cat.y * level.board.tileSize, width: level.board.tileSize, height: level.board.tileSize }, elapsed,
        () => drawCat(scene, { ...cat, elapsed }, level.board.tileSize, { frightened: (snapshot.powerTimer ?? 0) > 0, frightenedTime: snapshot.powerTimer ?? 0 }));
    });
    characters.forEach((character) => {
      drawWithVisualEffects(scene, character.effects, { left: character.x * level.board.tileSize, top: character.y * level.board.tileSize, width: level.board.tileSize, height: level.board.tileSize }, elapsed,
        () => drawWalker(scene, { ...character, direction: character.state, elapsed }, level.board.tileSize, { elapsed, hitTimer: 0 }));
    });
    drawWithVisualEffects(scene, player.effects, { left: player.x * level.board.tileSize, top: player.y * level.board.tileSize, width: level.board.tileSize, height: level.board.tileSize }, elapsed,
      () => drawWalker(scene, player, level.board.tileSize, { elapsed, hitTimer: snapshot.hitTimer }));
    if (options.editor?.showGrid) drawEditorGrid(scene, level);
    if (options.editor?.cursor) {
      const { x, y, width = 1, height = 1, color = 'rgba(245, 196, 81, 0.5)' } = options.editor.cursor;
      scene.fillStyle = color;
      scene.fillRect(x * level.board.tileSize + 2, y * level.board.tileSize + 2, width * level.board.tileSize - 4, height * level.board.tileSize - 4);
    }
    const display = this.resize(); const viewport = options.viewport ?? { x: 0, y: 0, width: display.width, height: display.height };
    const cameraTarget = options.cameraTarget ?? { x: player.x * level.board.tileSize + level.board.tileSize / 2, y: player.y * level.board.tileSize + level.board.tileSize / 2 };
    const camera = calculateCamera({ worldWidth, worldHeight, viewport, target: cameraTarget, zoom: options.zoom ?? this.zoom, enabled: options.cameraEnabled !== false });
    this.overlayContext.setTransform(1, 0, 0, 1, 0, 0); this.overlayContext.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const hasTextOverlay = this.presentText(renderLevel, camera, elapsed, options.language ?? 'standard');
    if (options.editor?.selections?.length) this.presentEditorSelections(options.editor.selections, camera, level.board.tileSize, elapsed);
    if (options.editor?.transformSelection) this.presentTransformSelection(options.editor.transformSelection, camera, level.board.tileSize);
    const profile = resolvePostProcessProfile(level, snapshot, { quality: options.quality ?? this.quality, reducedMotion: options.reducedMotion });
    const hasOverlay = hasTextOverlay || Boolean(options.editor?.selections?.length || options.editor?.transformSelection);
    this.present(camera, profile, elapsed, hasOverlay);
    const tile = level.board.tileSize; const playerScreen = projectWorldPoint(camera, { x: player.x * tile + tile / 2, y: player.y * tile + tile / 2 }); const bounds = visibleWorldBounds(camera);
    const entities = cats.map((cat, index) => { const world = { x: cat.x * tile + tile / 2, y: cat.y * tile + tile / 2 }; return { id: cat.id ?? `cat-${index + 1}`, index, screen: projectWorldPoint(camera, world), onScreen: world.x >= bounds.left && world.x <= bounds.right && world.y >= bounds.top && world.y <= bounds.bottom, distance: Math.hypot(player.x - cat.x, player.y - cat.y), color: cat.color, respawnTimer: cat.respawnTimer ?? 0 }; });
    const characterEntities = characters.map((character, index) => { const world = { x: character.x * tile + tile / 2, y: character.y * tile + tile / 2 }; return { id: character.id ?? `character-${index + 1}`, index, screen: projectWorldPoint(camera, world), onScreen: world.x >= bounds.left && world.x <= bounds.right && world.y >= bounds.top && world.y <= bounds.bottom, distance: Math.hypot(player.x - character.x, player.y - character.y), color: character.color }; });
    return { camera, playerScreen, entities, characterEntities, display, renderer: this.rendererInfo() };
  }

  setLevelIfChanged(levelInput) {
    if (this.levelInput === levelInput) return this.level;
    return this.setLevel(levelInput);
  }

  drawVignette(width, height) {
    const context = this.sceneContext; const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.32, width / 2, height / 2, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, 'rgba(2, 8, 12, 0)'); gradient.addColorStop(1, 'rgba(2, 8, 12, 0.28)'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  }

  present(camera, profile, elapsed, hasOverlay) {
    let scene = this.scene;
    let presentationCamera = camera;
    if (this.gpuScene && this.gpuSceneContext) {
      const scale = this.sceneScale;
      const sourceLeft = camera.source.x * scale;
      const sourceTop = camera.source.y * scale;
      const left = Math.max(0, Math.floor(sourceLeft));
      const top = Math.max(0, Math.floor(sourceTop));
      const right = Math.min(this.scene.width, Math.ceil((camera.source.x + camera.source.width) * scale));
      const bottom = Math.min(this.scene.height, Math.ceil((camera.source.y + camera.source.height) * scale));
      const width = Math.max(1, right - left);
      const height = Math.max(1, bottom - top);
      if (width * height < this.scene.width * this.scene.height * 0.88) {
        if (this.gpuScene.width !== width) this.gpuScene.width = width;
        if (this.gpuScene.height !== height) this.gpuScene.height = height;
        this.gpuSceneContext.setTransform(1, 0, 0, 1, 0, 0);
        this.gpuSceneContext.imageSmoothingEnabled = false;
        this.gpuSceneContext.clearRect(0, 0, width, height);
        this.gpuSceneContext.drawImage(this.scene, left, top, width, height, 0, 0, width, height);
        scene = this.gpuScene;
        presentationCamera = {
          ...camera,
          source: {
            x: (sourceLeft - left) / scale,
            y: (sourceTop - top) / scale,
            width: camera.source.width,
            height: camera.source.height,
          },
        };
      }
    }
    this.presentation.present({ scene, overlay: this.overlay, hasOverlay, camera: presentationCamera, profile, elapsed, pixelRatio: this.pixelRatio, sceneScale: this.sceneScale });
  }

  prepareEnvironment(level, elapsed, language) {
    // Ambient scenery intentionally runs at a lower cadence than actors. It is
    // visually indistinguishable for slow water/light motion, while avoiding a
    // full 625-tile redraw on every gameplay frame.
    // On GPU backends the post-process shader owns ambient movement. The
    // authored tile layer can therefore stay resident while actors keep their
    // full frame rate. Canvas2D retains a deliberately throttled animation.
    const framesPerSecond = this.presentation.kind === 'canvas2d'
      ? (this.quality === 'performance' ? 8 : this.quality === 'balanced' ? 15 : 20)
      : 0;
    const frame = framesPerSecond ? Math.floor(elapsed * framesPerSecond) : 0;
    const decorations = level.decorations;
    const cache = this.environmentCache;
    if (cache.board === level.board && cache.theme === level.theme && cache.decorations === decorations && cache.language === language && cache.frame === frame) return;
    const width = level.board.columns * level.board.tileSize; const height = level.board.rows * level.board.tileSize;
    const context = this.environmentContext;
    context.setTransform(this.sceneScale, 0, 0, this.sceneScale, 0, 0);
    context.clearRect(0, 0, width, height);
    drawEnvironment(context, level, this.grid, elapsed, { language, excludeText: true });
    const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.32, width / 2, height / 2, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, 'rgba(2, 8, 12, 0)'); gradient.addColorStop(1, 'rgba(2, 8, 12, 0.28)'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    this.environmentCache = { board: level.board, theme: level.theme, decorations, language, frame };
  }

  presentText(level, camera, elapsed, language) {
    const tile = level.board.tileSize;
    const bounds = visibleWorldBounds(camera);
    const items = level.decorations.filter((item) => item.type === 'text'
      && item.x * tile < bounds.right
      && (item.x + item.width) * tile > bounds.left
      && item.y * tile < bounds.bottom
      && (item.y + item.height) * tile > bounds.top);
    if (!items.length) return false;
    const context = this.overlayContext; const ratio = this.pixelRatio;
    const scale = camera.viewport.width / camera.source.width * ratio;
    const screenTile = tile * scale;
    const viewport = {
      x: camera.viewport.x * ratio,
      y: camera.viewport.y * ratio,
      width: camera.viewport.width * ratio,
      height: camera.viewport.height * ratio,
    };
    context.save(); context.beginPath(); context.rect(viewport.x, viewport.y, viewport.width, viewport.height); context.clip();
    items.forEach((item) => {
      const left = (camera.viewport.x + (item.x * tile - camera.source.x) / camera.source.width * camera.viewport.width) * ratio;
      const top = (camera.viewport.y + (item.y * tile - camera.source.y) / camera.source.height * camera.viewport.height) * ratio;
      const width = item.width * screenTile; const height = item.height * screenTile;
      drawDecoration(context, {
        ...item,
        x: Math.round(left) / screenTile,
        y: Math.round(top) / screenTile,
        width: Math.max(1, Math.round(width)) / screenTile,
        height: Math.max(1, Math.round(height)) / screenTile,
      }, screenTile, elapsed, language);
    });
    context.restore();
  }

  presentTransformSelection(selection, camera, tile) {
    const ratio = this.pixelRatio; const context = this.overlayContext;
    const project = (x, y) => ({
      x: (camera.viewport.x + (x * tile - camera.source.x) / camera.source.width * camera.viewport.width) * ratio,
      y: (camera.viewport.y + (y * tile - camera.source.y) / camera.source.height * camera.viewport.height) * ratio,
    });
    const start = project(selection.x, selection.y); const end = project(selection.x + selection.width, selection.y + selection.height);
    const left = Math.round(start.x) + 0.5; const top = Math.round(start.y) + 0.5;
    const width = Math.round(end.x - start.x); const height = Math.round(end.y - start.y);
    const handle = Math.max(8 * ratio, Math.min(14 * ratio, Math.min(width, height) * 0.24));
    context.save(); context.strokeStyle = '#f5c451'; context.lineWidth = Math.max(2, ratio * 1.5); context.setLineDash([6 * ratio, 3 * ratio]);
    context.strokeRect(left, top, width, height); context.setLineDash([]);
    [[left, top], [left + width, top], [left + width, top + height], [left, top + height]].forEach(([x, y]) => {
      context.fillStyle = '#071016'; context.fillRect(x - handle / 2, y - handle / 2, handle, handle);
      context.strokeStyle = '#55d9dd'; context.lineWidth = Math.max(2, ratio); context.strokeRect(x - handle / 2, y - handle / 2, handle, handle);
    });
    context.restore();
  }

  presentEditorSelections(selections, camera, tile, elapsed = 0) {
    const ratio = this.pixelRatio; const context = this.overlayContext;
    const project = (x, y) => ({
      x: (camera.viewport.x + (x * tile - camera.source.x) / camera.source.width * camera.viewport.width) * ratio,
      y: (camera.viewport.y + (y * tile - camera.source.y) / camera.source.height * camera.viewport.height) * ratio,
    });
    context.save();
    selections.forEach((selection, index) => {
      const start = project(selection.x, selection.y); const end = project(selection.x + (selection.width ?? 1), selection.y + (selection.height ?? 1));
      const inset = Math.max(2, ratio * 1.5); const left = Math.round(start.x) + inset; const top = Math.round(start.y) + inset;
      const width = Math.max(4, Math.round(end.x - start.x) - inset * 2); const height = Math.max(4, Math.round(end.y - start.y) - inset * 2);
      const primary = selection.primary !== false && index === selections.length - 1;
      context.strokeStyle = primary ? '#f5c451' : '#55d9dd';
      context.lineWidth = Math.max(primary ? 3 : 2, ratio * (primary ? 2 : 1.4));
      context.globalAlpha = primary ? 0.82 + Math.sin(elapsed * 5) * 0.14 : 0.78;
      context.shadowColor = context.strokeStyle; context.shadowBlur = primary ? 8 * ratio : 3 * ratio;
      context.setLineDash(primary ? [] : [5 * ratio, 3 * ratio]);
      context.strokeRect(left, top, width, height);
      context.setLineDash([]); context.shadowBlur = 0; context.globalAlpha = 1;
    });
    context.restore();
    return true;
  }

  rendererInfo() {
    return { ...this.presentation.snapshot(), quality: this.quality, pixelRatio: this.pixelRatio };
  }

  finish() { return this.presentation.finish?.(); }

  destroy() { this.presentation.destroy?.(); }
}
