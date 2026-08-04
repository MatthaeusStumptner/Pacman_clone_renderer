export function animationById(appearance, id) {
  return appearance?.animations?.find((animation) => animation.id === id) ?? null;
}

export function animationKeyframes(animation) {
  if (animation?.keyframes?.length) return animation.keyframes;
  const fps = Math.max(0.25, Number(animation?.fps) || 6);
  return (animation?.frames ?? []).map((frame, index) => ({
    id: `keyframe-${index + 1}`,
    time: index / fps,
    easing: 'step',
    pixels: frame.pixels,
  }));
}

export function animationDuration(animation) {
  const keyframes = animationKeyframes(animation);
  const fallback = Math.max(1 / Math.max(0.25, Number(animation?.fps) || 6), (keyframes.at(-1)?.time ?? 0) + 1 / Math.max(0.25, Number(animation?.fps) || 6));
  return Math.max(fallback, Number(animation?.duration) || 0);
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
  const keyframes = animationKeyframes(animation);
  if (!keyframes.length) return appearance.pixels;
  const duration = animationDuration(animation);
  const rawTime = Math.max(0, Number(elapsed) || 0);
  const time = animation.loop && duration > 0 ? rawTime % duration : Math.min(duration, rawTime);
  return ([...keyframes].reverse().find((frame) => frame.time <= time) ?? keyframes[0]).pixels;
}
