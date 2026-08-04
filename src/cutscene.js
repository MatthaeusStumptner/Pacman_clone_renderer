const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function easedRatio(value, easing) {
  const ratio = clamp(value, 0, 1);
  if (easing === 'step') return ratio < 1 ? 0 : 1;
  if (easing === 'ease-in-out') return ratio * ratio * (3 - 2 * ratio);
  return ratio;
}

function framesAround(keyframes, time) {
  const previous = [...keyframes].reverse().find((frame) => frame.time <= time) ?? keyframes[0];
  const next = keyframes.find((frame) => frame.time > time) ?? previous;
  const span = next.time - previous.time;
  return { previous, next, ratio: span > 0 ? easedRatio((time - previous.time) / span, next.easing) : 0 };
}

function samplePositionTrack(track, time) {
  const { previous, next, ratio } = framesAround(track.keyframes, time);
  const interpolate = (key, fallback = 0) => (Number(previous[key]) || fallback) + ((Number(next[key]) || fallback) - (Number(previous[key]) || fallback)) * ratio;
  return {
    x: interpolate('x'),
    y: interpolate('y'),
    ...(track.type === 'camera' ? { zoom: interpolate('zoom', 1.12) } : {
      state: ratio < 0.5 ? previous.state : next.state,
      animation: ratio < 0.5 ? previous.animation : next.animation,
      visible: ratio < 0.5 ? previous.visible : next.visible,
    }),
  };
}

export function cutsceneById(level, id = 'intro') {
  return level?.cutscenes?.find((cutscene) => cutscene.id === id || cutscene.kind === id) ?? null;
}

export function sampleCutscene(levelInput, cutsceneInput, elapsed = 0, language = 'standard') {
  const level = clone(levelInput);
  const cutscene = typeof cutsceneInput === 'string' ? cutsceneById(level, cutsceneInput) : cutsceneInput;
  if (!cutscene) return { level, time: 0, duration: 0, progress: 1, done: true, camera: null, dialogue: null };
  const time = clamp(Number(elapsed) || 0, 0, cutscene.duration);
  let camera = null;
  let dialogue = null;
  const hiddenObjects = new Set();
  cutscene.tracks.forEach((track) => {
    if (!track.keyframes?.length) return;
    if (track.type === 'dialogue') {
      const active = [...track.keyframes].reverse().find((frame) => time >= frame.time && time < frame.time + frame.duration);
      if (active) dialogue = { speaker: active.speaker, text: active.text?.[language] || active.text?.standard || '', remaining: active.time + active.duration - time };
      return;
    }
    const sampled = samplePositionTrack(track, time);
    if (track.type === 'camera') { camera = sampled; return; }
    if (track.type === 'object') {
      const object = level.decorations.find((item) => item.id === track.target);
      if (!object) return;
      object.x = sampled.x; object.y = sampled.y; object.spriteAnimation = sampled.animation || object.spriteAnimation;
      if (!sampled.visible) hiddenObjects.add(object.id);
      return;
    }
    const actor = track.target === 'player'
      ? level.actors.player
      : level.actors.cats.find((cat, index) => track.target === `cat:${cat.id ?? index}` || track.target === `cat:${index}`);
    if (!actor) return;
    actor.x = sampled.x; actor.y = sampled.y; actor.animation = sampled.animation || actor.animation;
    actor.direction = { name: sampled.state, x: sampled.state === 'left' ? -1 : sampled.state === 'right' ? 1 : 0, y: sampled.state === 'up' ? -1 : sampled.state === 'down' ? 1 : 0 };
    if (!sampled.visible) actor.hidden = true;
  });
  level.decorations = level.decorations.filter((item) => !hiddenObjects.has(item.id));
  level.actors.cats = level.actors.cats.filter((cat) => !cat.hidden);
  return {
    level,
    time,
    duration: cutscene.duration,
    progress: cutscene.duration ? time / cutscene.duration : 1,
    done: time >= cutscene.duration,
    camera,
    dialogue,
  };
}
