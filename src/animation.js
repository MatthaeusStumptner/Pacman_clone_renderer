export function animationById(appearance, id) {
  return appearance?.animations?.find((animation) => animation.id === id) ?? null;
}

export const ACTOR_ANIMATION_STATES = Object.freeze(['idle', 'up', 'right', 'down', 'left']);

export function actorAnimationState(actor = {}) {
  const direction = actor.direction ?? actor.dir;
  const name = typeof direction === 'string' ? direction : direction?.name;
  return ACTOR_ANIMATION_STATES.includes(name) && name !== 'idle' ? name : 'idle';
}

export function stateAnimationId(appearance, state = 'idle') {
  const normalizedState = ACTOR_ANIMATION_STATES.includes(state) ? state : 'idle';
  const mapped = appearance?.stateAnimations?.[normalizedState];
  if (mapped && animationById(appearance, mapped)) return mapped;
  if (animationById(appearance, normalizedState)) return normalizedState;
  if (normalizedState !== 'idle' && animationById(appearance, 'walk')) return 'walk';
  if (animationById(appearance, 'idle')) return 'idle';
  return '';
}

export function selectAppearanceFrame(appearance, { animationId = '', state = 'idle', elapsed = 0 } = {}) {
  if (!appearance) return null;
  const animation = animationById(appearance, animationId) ?? animationById(appearance, stateAnimationId(appearance, state));
  if (!animation?.frames?.length) return appearance.pixels;
  const rawIndex = Math.max(0, Math.floor(Math.max(0, Number(elapsed) || 0) * animation.fps));
  const index = animation.loop ? rawIndex % animation.frames.length : Math.min(animation.frames.length - 1, rawIndex);
  return animation.frames[index].pixels;
}
