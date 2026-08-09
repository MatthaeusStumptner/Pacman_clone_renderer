const EFFECT_MODES = Object.freeze({
  ambient: 0,
  water: 1,
  mist: 2,
  nature: 3,
  city: 4,
  industrial: 5,
  stage: 6,
});

const MODE_PRIORITY = Object.freeze([
  ['stage', new Set(['stage-pulse'])],
  ['industrial', new Set(['steam', 'sparks'])],
  ['water', new Set(['water-flow', 'fish', 'boat'])],
  ['nature', new Set(['leaves', 'fireflies'])],
  ['city', new Set(['city-lights', 'birds'])],
  ['mist', new Set(['fog'])],
]);

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

function colorChannels(value, fallback = '#55d9dd') {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? '') ?? /^#([0-9a-f]{6})$/i.exec(fallback);
  const numeric = Number.parseInt(match[1], 16);
  return [((numeric >> 16) & 255) / 255, ((numeric >> 8) & 255) / 255, (numeric & 255) / 255];
}

function effectMode(level) {
  const types = new Set((level?.theme?.edgeEffects ?? []).map((effect) => effect.type));
  return MODE_PRIORITY.find(([, candidates]) => [...candidates].some((type) => types.has(type)))?.[0] ?? 'ambient';
}

function profileColor(level, mode) {
  const palette = level?.theme?.palette ?? {};
  if (mode === 'water') return palette.water;
  if (mode === 'stage') return '#ff4f87';
  if (mode === 'industrial') return '#ef9146';
  if (mode === 'nature') return '#6fdb9e';
  if (mode === 'city') return '#f5c451';
  return Array.isArray(palette.walls) ? palette.walls[0] : palette.curb;
}

export function resolveRendererQuality(value = 'auto', environment = globalThis.navigator) {
  if (['performance', 'balanced', 'quality'].includes(value)) return value;
  const memory = Number(environment?.deviceMemory) || 8;
  const cores = Number(environment?.hardwareConcurrency) || 8;
  // Browser-reported memory is deliberately coarse and often capped at 4 GB on
  // perfectly capable phones. Only genuinely constrained devices lose internal
  // resolution; the runtime GPU probe remains the final authority for effects.
  if (memory <= 2 || cores <= 2) return 'performance';
  if (memory <= 4 || cores <= 4) return 'balanced';
  return 'quality';
}

export function rendererPixelRatioLimit(quality) {
  if (quality === 'performance') return 1.25;
  if (quality === 'balanced') return 1.6;
  return 2;
}

export function resolvePostProcessProfile(level, snapshot = {}, options = {}) {
  const mode = effectMode(level);
  const edgeEffects = level?.theme?.edgeEffects ?? [];
  const authoredIntensity = edgeEffects.length
    ? edgeEffects.reduce((sum, effect) => sum + clamp(effect.intensity ?? 0.55), 0) / edgeEffects.length
    : 0.35;
  const quality = resolveRendererQuality(options.quality);
  const reducedMotion = Boolean(options.reducedMotion);
  const motionScale = reducedMotion ? 0 : quality === 'performance' ? 0.55 : quality === 'balanced' ? 0.78 : 1;
  const [red, green, blue] = colorChannels(profileColor(level, mode));
  return Object.freeze({
    mode,
    modeIndex: EFFECT_MODES[mode],
    intensity: clamp(authoredIntensity * (quality === 'performance' ? 0.62 : quality === 'balanced' ? 0.82 : 1), 0.08, 0.92),
    motionScale,
    reducedMotion,
    quality,
    tint: Object.freeze([red, green, blue]),
    power: clamp((Number(snapshot.powerTimer) || 0) / 6),
    hit: clamp((Number(snapshot.hitTimer) || 0) / 0.9),
    vignette: quality === 'performance' ? 0.08 : 0.14,
    scanlines: reducedMotion ? 0.02 : quality === 'quality' ? 0.075 : 0.045,
  });
}

export { EFFECT_MODES };
