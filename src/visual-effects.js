export const VISUAL_EFFECT_TYPES = Object.freeze(['glitch', 'neon', 'hologram', 'echo', 'sparkle']);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
const slug = (value, fallback) => String(value || fallback).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

export function normalizeVisualEffects(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((effect, index) => ({
    id: slug(effect?.id, `effect-${index + 1}`),
    type: VISUAL_EFFECT_TYPES.includes(effect?.type) ? effect.type : 'glitch',
    intensity: clamp(effect?.intensity ?? 0.55, 0.05, 1),
    speed: clamp(effect?.speed ?? 1, 0.1, 8),
    color: color(effect?.color, effect?.type === 'neon' ? '#55d9dd' : '#ff4f87'),
  }));
}

function drawEcho(context, effect, bounds, elapsed, draw) {
  const distance = Math.max(1, Math.min(bounds.width, bounds.height) * 0.12 * effect.intensity);
  for (let index = 3; index >= 1; index -= 1) {
    const phase = elapsed * effect.speed * 3 + index * 0.9;
    context.save();
    context.globalAlpha *= 0.08 + effect.intensity * 0.09;
    context.filter = `hue-rotate(${Math.round(index * 38)}deg) saturate(1.8)`;
    context.translate(Math.cos(phase) * distance * index, Math.sin(phase * 0.7) * distance * index * 0.45);
    draw();
    context.restore();
  }
}

function drawGlitch(context, effect, bounds, elapsed, draw) {
  const slices = 3 + Math.round(effect.intensity * 5);
  const sliceHeight = bounds.height / slices;
  for (let index = 0; index < slices; index += 1) {
    if ((index + Math.floor(elapsed * effect.speed * 12)) % 3 === 0) continue;
    const jitter = Math.sin(elapsed * effect.speed * 31 + index * 12.7) * bounds.width * 0.12 * effect.intensity;
    context.save();
    context.beginPath(); context.rect(bounds.left - 4, bounds.top + index * sliceHeight, bounds.width + 8, sliceHeight + 1); context.clip();
    context.globalAlpha *= 0.22 + effect.intensity * 0.24;
    context.filter = `hue-rotate(${jitter > 0 ? 155 : 305}deg) saturate(2.4)`;
    context.translate(Math.round(jitter), 0); draw(); context.restore();
  }
}

function drawHologramLines(context, effect, bounds, elapsed) {
  const spacing = Math.max(3, Math.round(7 - effect.intensity * 4));
  const offset = Math.floor(elapsed * effect.speed * 18) % spacing;
  context.save(); context.globalAlpha *= 0.1 + effect.intensity * 0.16; context.fillStyle = effect.color;
  for (let y = bounds.top + offset; y < bounds.top + bounds.height; y += spacing) context.fillRect(bounds.left, y, bounds.width, 1);
  context.restore();
}

function drawSparkles(context, effect, bounds, elapsed) {
  const count = 3 + Math.round(effect.intensity * 8);
  context.save(); context.fillStyle = effect.color;
  for (let index = 0; index < count; index += 1) {
    const phase = elapsed * effect.speed * (0.8 + index * 0.03) + index * 2.417;
    const x = bounds.left + (Math.sin(phase * 1.7) * 0.5 + 0.5) * bounds.width;
    const y = bounds.top + (Math.cos(phase * 1.13) * 0.5 + 0.5) * bounds.height;
    const visible = Math.sin(phase * 5.3) > 0.1;
    if (visible) { const size = 1 + (index % 2); context.globalAlpha = 0.35 + effect.intensity * 0.55; context.fillRect(Math.round(x), Math.round(y), size, size); }
  }
  context.restore();
}

export function drawWithVisualEffects(context, value, bounds, elapsed, draw) {
  const effects = normalizeVisualEffects(value);
  if (!effects.length) return draw();
  effects.filter((effect) => effect.type === 'echo').forEach((effect) => drawEcho(context, effect, bounds, elapsed, draw));

  context.save();
  const neon = effects.find((effect) => effect.type === 'neon');
  const hologram = effects.find((effect) => effect.type === 'hologram');
  if (neon) { context.shadowColor = neon.color; context.shadowBlur = Math.max(2, Math.min(bounds.width, bounds.height) * neon.intensity * 0.42); }
  if (hologram) {
    context.globalAlpha *= 0.58 + (Math.sin(elapsed * hologram.speed * 8) * 0.5 + 0.5) * 0.3;
    context.filter = `hue-rotate(${Math.round(elapsed * hologram.speed * 45) % 360}deg) saturate(1.7)`;
  }
  const result = draw();
  context.restore();

  effects.filter((effect) => effect.type === 'glitch').forEach((effect) => drawGlitch(context, effect, bounds, elapsed, draw));
  effects.filter((effect) => effect.type === 'hologram').forEach((effect) => drawHologramLines(context, effect, bounds, elapsed));
  effects.filter((effect) => effect.type === 'sparkle').forEach((effect) => drawSparkles(context, effect, bounds, elapsed));
  return result;
}
