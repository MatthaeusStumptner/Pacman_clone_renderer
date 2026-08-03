export function drawCollectibles(context, { pellets = [], powerUps = [] }, tileSize, elapsed = 0) {
  context.fillStyle = '#f4c552';
  for (const key of pellets) {
    const [x, y] = String(key).split(',').map(Number); const size = (x + y) % 3 === 0 ? 4 : 3;
    context.fillRect(x * tileSize + (tileSize - size) / 2, y * tileSize + (tileSize - size) / 2, size, size);
  }
  for (const key of powerUps) {
    const [x, y] = String(key).split(',').map(Number); const px = x * tileSize + tileSize / 2; const py = y * tileSize + tileSize / 2;
    const glow = 0.55 + Math.sin(elapsed * 6) * 0.18; context.fillStyle = `rgba(76, 224, 179, ${glow})`;
    context.fillRect(px - 4, py - 2, 8, 7); context.fillRect(px - 6, py - 6, 3, 3); context.fillRect(px - 1, py - 8, 3, 3); context.fillRect(px + 4, py - 6, 3, 3);
  }
}

export function drawEasterEggs(context, level, eggs = {}, elapsed = 0) {
  const tile = level.board.tileSize;
  if (eggs.ilzvogel) {
    const px = 9; const py = 6 * tile + (eggs.active === 'ilzvogel' ? Math.round(Math.sin(elapsed * 10) * 3) : 0);
    context.fillStyle = '#31b7cf'; context.fillRect(px - 4, py - 5, 11, 11); context.fillStyle = '#ef9146'; context.fillRect(px + 1, py + 1, 8, 6);
  }
  if (eggs.hundewiese) {
    const px = level.board.columns * tile / 2; const py = level.board.rows * tile * 0.488;
    context.fillStyle = eggs.active === 'hundewiese' ? '#f5c451' : '#75a27c'; context.globalAlpha = 0.82;
    context.fillRect(px - 6, py - 1, 12, 9); context.fillRect(px - 10, py - 8, 5, 5); context.fillRect(px - 3, py - 11, 5, 5); context.fillRect(px + 5, py - 8, 5, 5); context.globalAlpha = 1;
  }
}
