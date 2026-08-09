import { WEBGL_FRAGMENT_SHADER, WEBGL_VERTEX_SHADER } from './shaders.js';

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unbekannter Shaderfehler';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, WEBGL_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, WEBGL_FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'WebGL-Programm konnte nicht verknüpft werden.';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, width: 0, height: 0 };
}

function uploadCanvas(gl, record, source) {
  gl.bindTexture(gl.TEXTURE_2D, record.texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  if (record.width !== source.width || record.height !== source.height) {
    record.width = source.width;
    record.height = source.height;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

export class WebGL2PresentationBackend {
  constructor(canvas, context) {
    this.canvas = canvas;
    this.gl = context;
    this.kind = 'webgl2';
    this.frameCount = 0;
    this.uploadedBytes = 0;
    this.contextLost = false;
    this.emptyOverlay = (canvas.ownerDocument ?? globalThis.document).createElement('canvas');
    this.emptyOverlay.width = 1; this.emptyOverlay.height = 1;
    this.handleLost = (event) => { event.preventDefault(); this.contextLost = true; };
    this.handleRestored = () => { this.contextLost = false; this.initialize(); };
    canvas.addEventListener?.('webglcontextlost', this.handleLost);
    canvas.addEventListener?.('webglcontextrestored', this.handleRestored);
    this.initialize();
  }

  initialize() {
    const gl = this.gl;
    this.program = createProgram(gl);
    this.sceneTexture = createTexture(gl);
    this.overlayTexture = createTexture(gl);
    this.locations = {
      scene: gl.getUniformLocation(this.program, 'u_scene'),
      overlay: gl.getUniformLocation(this.program, 'u_overlay'),
      source: gl.getUniformLocation(this.program, 'u_source'),
      canvasSize: gl.getUniformLocation(this.program, 'u_canvas_size'),
      effect: gl.getUniformLocation(this.program, 'u_effect'),
      tint: gl.getUniformLocation(this.program, 'u_tint'),
      feedback: gl.getUniformLocation(this.program, 'u_feedback'),
    };
    gl.useProgram(this.program);
    gl.uniform1i(this.locations.scene, 0);
    gl.uniform1i(this.locations.overlay, 1);
  }

  resize(width, height) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  present({ scene, overlay, hasOverlay = true, camera, pixelRatio, profile, elapsed = 0, sceneScale = 2 }) {
    const gl = this.gl;
    if (this.contextLost || gl.isContextLost?.()) return;
    gl.activeTexture(gl.TEXTURE0);
    uploadCanvas(gl, this.sceneTexture, scene);
    gl.activeTexture(gl.TEXTURE1);
    const overlaySource = hasOverlay ? overlay : this.emptyOverlay;
    uploadCanvas(gl, this.overlayTexture, overlaySource);
    this.uploadedBytes += (scene.width * scene.height + overlaySource.width * overlaySource.height) * 4;

    const viewportX = Math.round(camera.viewport.x * pixelRatio);
    const viewportWidth = Math.max(1, Math.round(camera.viewport.width * pixelRatio));
    const viewportHeight = Math.max(1, Math.round(camera.viewport.height * pixelRatio));
    const viewportY = this.canvas.height - Math.round((camera.viewport.y + camera.viewport.height) * pixelRatio);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0.015, 0.035, 0.048, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.useProgram(this.program);
    gl.uniform4f(this.locations.source,
      camera.source.x * sceneScale / scene.width,
      camera.source.y * sceneScale / scene.height,
      camera.source.width * sceneScale / scene.width,
      camera.source.height * sceneScale / scene.height);
    gl.uniform2f(this.locations.canvasSize, this.canvas.width, this.canvas.height);
    gl.uniform4f(this.locations.effect, elapsed, profile.modeIndex, profile.intensity, profile.motionScale);
    gl.uniform4f(this.locations.tint, profile.tint[0], profile.tint[1], profile.tint[2], profile.vignette);
    gl.uniform4f(this.locations.feedback, profile.power, profile.hit, profile.reducedMotion ? 1 : 0, profile.scanlines);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.frameCount += 1;
  }

  finish() { if (!this.contextLost) this.gl.finish(); }

  snapshot() {
    return {
      backend: this.kind,
      frameCount: this.frameCount,
      gpuAccelerated: true,
      contextLost: this.contextLost,
      uploadedBytes: this.uploadedBytes,
    };
  }

  destroy() {
    this.canvas.removeEventListener?.('webglcontextlost', this.handleLost);
    this.canvas.removeEventListener?.('webglcontextrestored', this.handleRestored);
    if (this.contextLost) return;
    this.gl.deleteTexture(this.sceneTexture?.texture);
    this.gl.deleteTexture(this.overlayTexture?.texture);
    this.gl.deleteProgram(this.program);
  }
}

export function createWebGL2Backend(canvas, options = {}) {
  const context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    desynchronized: options.desynchronized !== false,
    powerPreference: options.powerPreference ?? 'low-power',
    preserveDrawingBuffer: false,
  });
  if (!context || typeof context.createShader !== 'function') return null;
  return new WebGL2PresentationBackend(canvas, context);
}
