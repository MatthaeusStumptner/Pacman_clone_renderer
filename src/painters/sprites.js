import { selectAppearanceFrame } from '../animation.js';

export function drawPixelSprite(context, appearance, bounds, { animationId = '', state = 'idle', elapsed = 0 } = {}) {
  if (!appearance) return false;
  const availableWidth = Math.max(1, Number(bounds.width) || appearance.width);
  const availableHeight = Math.max(1, Number(bounds.height) || appearance.height);
  const scale = Math.max(1, Math.floor(Math.min(availableWidth / appearance.width, availableHeight / appearance.height)));
  const width = appearance.width * scale;
  const height = appearance.height * scale;
  const left = Math.round((Number(bounds.left) || 0) + (availableWidth - width) / 2);
  const top = Math.round((Number(bounds.top) || 0) + (availableHeight - height) / 2);
  const pixels = selectAppearanceFrame(appearance, { animationId, state, elapsed });
  pixels.forEach((row, y) => [...row].forEach((token, x) => {
    const paletteIndex = Number.parseInt(token, 36);
    const pixelColor = appearance.palette[paletteIndex];
    if (!pixelColor || pixelColor === 'transparent') return;
    context.fillStyle = pixelColor;
    context.fillRect(left + x * scale, top + y * scale, scale, scale);
  }));
  return true;
}

export function drawActorAppearance(context, actor, tileSize, options = {}) {
  return drawPixelSprite(context, actor?.appearance, {
    left: actor.x * tileSize + tileSize * 0.05,
    top: actor.y * tileSize + tileSize * 0.05,
    width: tileSize * 0.9,
    height: tileSize * 0.9,
  }, options);
}
