export function animationById(appearance, id) {
  return appearance?.animations?.find((animation) => animation.id === id) ?? null;
}

export function selectAppearanceFrame(appearance, { animationId = '', elapsed = 0 } = {}) {
  if (!appearance) return null;
  const animation = animationById(appearance, animationId);
  if (!animation?.frames?.length) return appearance.pixels;
  const rawIndex = Math.max(0, Math.floor(Math.max(0, Number(elapsed) || 0) * animation.fps));
  const index = animation.loop ? rawIndex % animation.frames.length : Math.min(animation.frames.length - 1, rawIndex);
  return animation.frames[index].pixels;
}
