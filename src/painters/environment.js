function isWall(grid, x, y) {
  return Boolean(grid[y]?.[x]);
}

function drawStreetTile(context, level, grid, x, y) {
  const { tileSize } = level.board;
  const px = x * tileSize;
  const py = y * tileSize;
  const { palette } = level.theme;
  const shade = (x * 17 + y * 11) % palette.ground.length;
  context.fillStyle = palette.ground[shade];
  context.fillRect(px, py, tileSize, tileSize);
  context.fillStyle = shade % 2 ? '#23333d' : '#202f38';
  if ((x * 5 + y * 7) % 3 === 0) context.fillRect(px + tileSize / 6, py + tileSize / 5, 2, 1);
  if ((x * 7 + y * 3) % 5 === 0) context.fillRect(px + tileSize * 0.66, py + tileSize * 0.7, 3, 1);
  context.fillStyle = palette.curb;
  if (isWall(grid, x, y - 1)) context.fillRect(px, py, tileSize, 2);
  if (isWall(grid, x, y + 1)) context.fillRect(px, py + tileSize - 2, tileSize, 2);
  if (isWall(grid, x - 1, y)) context.fillRect(px, py, 2, tileSize);
  if (isWall(grid, x + 1, y)) context.fillRect(px + tileSize - 2, py, 2, tileSize);
}

function drawBuildingTile(context, level, grid, x, y) {
  const { tileSize, columns } = level.board;
  const px = x * tileSize;
  const py = y * tileSize;
  const { palette } = level.theme;
  if (x === 0 || x === columns - 1) {
    context.fillStyle = palette.water;
    context.fillRect(px, py, tileSize, tileSize);
    context.fillStyle = '#167b8e';
    context.fillRect(px + ((y * 7) % 8), py + tileSize * 0.25, tileSize / 2, 2);
    context.fillRect(px + ((y * 11 + 5) % 9), py + tileSize * 0.66, tileSize * 0.42, 2);
    return;
  }
  const tone = palette.walls[(x * 3 + y * 5) % palette.walls.length];
  context.fillStyle = '#0e2733';
  context.fillRect(px, py, tileSize, tileSize);
  context.fillStyle = tone;
  context.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
  context.fillStyle = '#48707a';
  if (!isWall(grid, x, y - 1)) context.fillRect(px + 2, py, tileSize - 4, 3);
  if (!isWall(grid, x - 1, y)) context.fillRect(px, py + 2, 3, tileSize - 4);
  if ((x * 13 + y * 7) % 9 === 0) {
    context.fillStyle = '#d0a94d';
    context.fillRect(px + tileSize * 0.34, py + tileSize * 0.3, tileSize * 0.3, tileSize * 0.25);
  } else if ((x + y) % 4 === 0) {
    context.fillStyle = '#26353d';
    context.fillRect(px + tileSize * 0.3, py + tileSize * 0.34, tileSize * 0.38, 2);
  }
}

function drawDogPark(context, level, grid) {
  const { columns, rows, tileSize } = level.board;
  const fromX = Math.floor(columns / 2) - 2;
  const fromY = Math.floor(rows / 2) - 2;
  for (let y = fromY; y <= fromY + 4; y += 1) {
    for (let x = fromX; x <= fromX + 4; x += 1) {
      if (grid[y]?.[x]) continue;
      context.fillStyle = (x + y) % 2 ? '#16382f' : '#183d33';
      context.globalAlpha = 0.72;
      context.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
    }
  }
  context.globalAlpha = 1;
  context.fillStyle = '#77a888';
  context.font = `${Math.max(6, Math.round(tileSize * 0.3))}px monospace`;
  context.textAlign = 'center';
  context.fillText('HUNDEWIESE', columns * tileSize / 2, fromY * tileSize + 10);
}

function drawHome(context, level) {
  const { columns, tileSize } = level.board;
  const width = 7 * tileSize;
  const left = (columns * tileSize - width) / 2;
  const top = 5.4 * tileSize;
  context.fillStyle = '#201b17';
  context.fillRect(left + 6, top + 22, width - 12, 79);
  context.fillStyle = '#8a6a45';
  context.fillRect(left + 12, top + 29, width - 24, 65);
  context.fillStyle = '#4f3528';
  for (let step = 0; step < 6; step += 1) context.fillRect(left + 10 + step * 12, top + 18 - step * 3, width - 20 - step * 24, 6);
  context.fillStyle = '#d8b85a';
  context.fillRect(left + 28, top + 43, 18, 15);
  context.fillRect(left + width - 46, top + 43, 18, 15);
  context.fillStyle = '#4a332b';
  context.fillRect(left + width / 2 - 11, top + 58, 22, 36);
  context.fillStyle = '#f5e7bd';
  context.font = '7px monospace';
  context.textAlign = 'center';
  context.fillText('FRANZ & LOLA', left + width / 2, top + 37);
}

function drawBschuett(context, level) {
  const { columns, rows, tileSize } = level.board;
  const width = 5.5 * tileSize;
  const height = 5.5 * tileSize;
  const left = (columns * tileSize - width) / 2;
  const top = (rows * tileSize - height) / 2;
  context.fillStyle = '#194b3b';
  context.fillRect(left, top, width, height);
  context.strokeStyle = '#83bfa0';
  context.lineWidth = 2;
  context.strokeRect(left + 3, top + 3, width - 6, height - 6);
  context.beginPath();
  context.moveTo(left + width / 2, top + 3);
  context.lineTo(left + width / 2, top + height - 3);
  context.stroke();
  context.fillStyle = '#718184';
  context.fillRect(left + 10, top + 24, 24, 5);
  context.fillRect(left + width - 38, top + height - 29, 24, 5);
  context.fillStyle = '#8fcfa8';
  context.font = '7px monospace';
  context.textAlign = 'center';
  context.fillText('BSCHÜTT · SKATE & SPIEL', left + width / 2, top - 7);
}

function drawFactory(context, level) {
  const { columns, tileSize } = level.board;
  const width = 7 * tileSize;
  const height = 4.9 * tileSize;
  const left = (columns * tileSize - width) / 2;
  const top = 5.25 * tileSize;
  context.fillStyle = '#321f1b';
  context.fillRect(left + 3, top + 8, width - 6, height - 8);
  context.fillStyle = '#8a4d38';
  context.fillRect(left + 8, top + 17, width - 16, height - 22);
  context.fillStyle = '#4d2f28';
  for (let row = 0; row < 8; row += 1) context.fillRect(left + 8, top + 29 + row * 10, width - 16, 1);
  context.fillStyle = '#221a1a';
  context.fillRect(left + 20, top - 9, 18, 27);
  context.fillRect(left + width - 39, top - 2, 13, 20);
  context.fillStyle = '#e2a750';
  for (const x of [left + 24, left + 58, left + width - 70, left + width - 36]) context.fillRect(x, top + 38, 14, 12);
  context.fillStyle = '#f0d0a0';
  context.font = '7px monospace';
  context.textAlign = 'center';
  context.fillText('TABAKFABRIK', left + width / 2, top + 31);
}

function themeElementAnimation(level, id, fallback) {
  return level.theme.elements?.find((element) => element.id === id)?.animation ?? fallback;
}

function applyMotionAnimation(context, animation, elapsed, centerX, centerY, tile) {
  const phase = elapsed * Math.PI * 2 * animation.speed;
  context.translate(centerX, centerY);
  if (animation.type === 'bob') context.translate(0, Math.sin(phase) * tile * animation.amplitude);
  if (animation.type === 'pulse') { const scale = 1 + Math.sin(phase) * animation.amplitude; context.scale(scale, scale); }
  if (animation.type === 'spin') context.rotate(phase * animation.amplitude);
  if (animation.type === 'blink') context.globalAlpha *= Math.sin(phase) > 0 ? 1 : Math.max(0.08, 1 - animation.amplitude);
  context.translate(-centerX, -centerY);
}

function drawStage(context, level, elapsed) {
  const { columns, tileSize } = level.board;
  const width = 9 * tileSize;
  const height = 5.6 * tileSize;
  const left = (columns * tileSize - width) / 2;
  const top = 4.55 * tileSize;
  context.fillStyle = '#0b0810';
  context.fillRect(left + 4, top + 9, width - 8, height - 9);
  context.fillStyle = '#34203f';
  context.fillRect(left + 12, top + 17, width - 24, height - 28);
  context.save(); context.globalAlpha = 0.16; applyMotionAnimation(context, themeElementAnimation(level, 'stage-lights', { type: 'none', speed: 1, amplitude: 0.15 }), elapsed, left + width / 2, top + height / 2, tileSize);
  zauberbergSpotlightPolygons(left, top, width, height).forEach(({ color, points }) => {
    context.fillStyle = color; context.beginPath(); context.moveTo(...points[0]); points.slice(1).forEach((point) => context.lineTo(...point)); context.closePath(); context.fill();
  });
  context.restore();
  context.fillStyle = '#131018';
  context.fillRect(left + 15, top + 43, 28, 65);
  context.fillRect(left + width - 43, top + 43, 28, 65);
  context.fillStyle = '#9d4778';
  [left + 23, left + width - 35].forEach((speakerX) => { context.fillRect(speakerX, top + 54, 12, 12); context.fillRect(speakerX, top + 79, 12, 12); });
  context.fillStyle = '#17101c'; context.fillRect(left + 54, top + height - 35, 31, 25); context.fillRect(left + width - 85, top + height - 35, 31, 25);
  context.fillStyle = '#ff5d93';
  context.font = '8px monospace';
  context.textAlign = 'center';
  context.fillText('⚡ ZAUBERBERG ⚡', left + width / 2, top + 34);
  context.fillStyle = '#f1e0b7';
  context.font = '7px monospace';
  context.fillText('ROCK · PUNK · METAL', left + width / 2, top + 49);
  context.save(); applyMotionAnimation(context, themeElementAnimation(level, 'stage-note', { type: 'bob', speed: 1.1, amplitude: 0.125 }), elapsed, left + width / 2, top + 79, tileSize);
  context.fillStyle = '#63d9d4';
  zauberbergNoteRectangles(left, top, width, 0).forEach(([x, y, noteWidth, noteHeight]) => context.fillRect(x, y, noteWidth, noteHeight));
  context.restore();
}

export function zauberbergSpotlightPolygons(left, top, width, height) {
  return [
    { color: '#ff4f87', points: [[left + 35, top + 20], [left + 74, top + height + 78], [left + 112, top + height + 78]] },
    { color: '#55d9dd', points: [[left + width - 35, top + 20], [left + width - 112, top + height + 78], [left + width - 70, top + height + 78]] },
  ];
}

export function zauberbergNoteRectangles(left, top, width, bounce = 0) {
  return [
    [left + width / 2 - 2, top + 68 + bounce, 4, 21],
    [left + width / 2 + 2, top + 68 + bounce, 11, 4],
    [left + width / 2 + 9, top + 71 + bounce, 4, 7],
  ];
}

export function drawEnvironment(context, level, grid, elapsed = 0) {
  const { columns, rows, tileSize } = level.board;
  context.fillStyle = '#0b1620';
  context.fillRect(0, 0, columns * tileSize, rows * tileSize);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (grid[y][x]) drawBuildingTile(context, level, grid, x, y);
      else drawStreetTile(context, level, grid, x, y);
    }
  }
  if (level.theme.landmark === 'bschuett') drawBschuett(context, level);
  else if (level.theme.landmark === 'tabakfabrik') drawFactory(context, level);
  else if (level.theme.landmark === 'zauberberg') drawStage(context, level, elapsed);
  else drawDogPark(context, level, grid);
  if (level.theme.landmark === 'brahmahof-home') drawHome(context, level);
  drawDecorations(context, level, elapsed);
}

function drawDecorations(context, level, elapsed) {
  const tile = level.board.tileSize;
  level.decorations.forEach((item) => {
    const left = item.x * tile;
    const top = item.y * tile;
    const width = item.width * tile;
    const height = item.height * tile;
    context.save();
    const animation = item.animation ?? { type: 'none', speed: 1, amplitude: 0.15 };
    const phase = elapsed * Math.PI * 2 * animation.speed;
    const centerX = left + width / 2; const centerY = top + height / 2;
    context.translate(centerX, centerY);
    if (animation.type === 'bob') context.translate(0, Math.sin(phase) * tile * animation.amplitude);
    if (animation.type === 'pulse') { const scale = 1 + Math.sin(phase) * animation.amplitude; context.scale(scale, scale); }
    if (animation.type === 'spin') context.rotate(phase * animation.amplitude);
    if (animation.type === 'blink') context.globalAlpha = Math.sin(phase) > 0 ? 1 : Math.max(0.08, 1 - animation.amplitude);
    context.translate(-centerX, -centerY);
    context.fillStyle = item.color;
    if (item.appearance && drawPixelSprite(context, item.appearance, { left, top, width, height }, { animationId: item.spriteAnimation ?? '', state: 'idle', elapsed })) {
      // Freely authored sprite objects use the same animation format as actors.
    } else if (item.type === 'tree') {
      context.fillStyle = '#5c3b2a'; context.fillRect(left + width * 0.43, top + height * 0.48, Math.max(2, width * 0.14), height * 0.42);
      context.fillStyle = item.color; context.fillRect(left + width * 0.2, top + height * 0.08, width * 0.6, height * 0.55);
    } else if (item.type === 'bench') {
      context.fillRect(left + width * 0.12, top + height * 0.46, width * 0.76, Math.max(3, height * 0.16));
      context.fillRect(left + width * 0.2, top + height * 0.62, 3, height * 0.22); context.fillRect(left + width * 0.76, top + height * 0.62, 3, height * 0.22);
    } else if (item.type === 'lamp') {
      context.fillRect(left + width * 0.47, top + height * 0.25, Math.max(2, width * 0.08), height * 0.65);
      context.fillStyle = '#f5c451'; context.fillRect(left + width * 0.32, top + height * 0.08, width * 0.38, height * 0.25);
    } else if (item.type === 'flower') {
      context.fillRect(left + width * 0.46, top + height * 0.42, 2, height * 0.4);
      context.fillStyle = '#f5c451'; context.fillRect(left + width * 0.32, top + height * 0.22, width * 0.36, height * 0.3);
    } else if (item.type === 'water') {
      context.globalAlpha = 0.72; context.fillRect(left + 2, top + 2, width - 4, height - 4);
      context.fillStyle = 'rgba(255,255,255,.28)'; context.fillRect(left + width * 0.15, top + height * 0.38, width * 0.55, 2);
    } else if (item.type === 'rock') {
      context.fillRect(left + width * 0.2, top + height * 0.3, width * 0.62, height * 0.5);
    } else {
      context.font = `${Math.max(8, Math.floor(Math.min(width, height) * 0.55))}px monospace`;
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(item.label || '◆', left + width / 2, top + height / 2);
    }
    if (item.type === 'sign') {
      context.fillRect(left + width * 0.46, top + height * 0.48, Math.max(2, width * 0.08), height * 0.42);
      context.fillRect(left + width * 0.08, top + height * 0.08, width * 0.84, height * 0.45);
      context.fillStyle = '#071016'; context.font = `${Math.max(5, Math.floor(tile * 0.22))}px monospace`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(item.label.slice(0, 12), left + width / 2, top + height * 0.3);
    }
    context.restore();
  });
}

export function drawEditorGrid(context, level) {
  const { columns, rows, tileSize } = level.board;
  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.16)';
  context.lineWidth = 1;
  for (let x = 0; x <= columns; x += 1) {
    context.beginPath();
    context.moveTo(x * tileSize + 0.5, 0);
    context.lineTo(x * tileSize + 0.5, rows * tileSize);
    context.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    context.beginPath();
    context.moveTo(0, y * tileSize + 0.5);
    context.lineTo(columns * tileSize, y * tileSize + 0.5);
    context.stroke();
  }
  context.restore();
}
import { drawPixelSprite } from './sprites.js';
