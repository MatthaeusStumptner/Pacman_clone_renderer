import { WEBGPU_SHADER } from './shaders.js';

const UNIFORM_FLOATS = 20;

export class WebGPUPresentationBackend {
  constructor(canvas, gpu, adapter, device, context, format, pipeline) {
    this.canvas = canvas;
    this.gpu = gpu;
    this.adapter = adapter;
    this.device = device;
    this.context = context;
    this.format = format;
    this.pipeline = pipeline;
    this.kind = 'webgpu';
    this.frameCount = 0;
    this.uploadedBytes = 0;
    this.contextLost = false;
    this.destroyed = false;
    this.emptyOverlay = (canvas.ownerDocument ?? globalThis.document).createElement('canvas');
    this.emptyOverlay.width = 1; this.emptyOverlay.height = 1;
    this.sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.watchDevice();
  }

  watchDevice() {
    this.device.lost.then((info) => {
      this.contextLost = true;
      if (!this.destroyed && info.reason !== 'destroyed') this.recover();
    });
  }

  async recover() {
    try {
      const replacement = await initializeWebGPU(this.canvas, { gpu: this.gpu, adapter: this.adapter });
      if (!replacement || this.destroyed) return;
      this.device = replacement.device;
      this.context = replacement.context;
      this.format = replacement.format;
      this.pipeline = replacement.pipeline;
      this.sampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
      this.uniformBuffer = this.device.createBuffer({ size: UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.sceneTexture = null;
      this.overlayTexture = null;
      this.bindGroup = null;
      this.contextLost = false;
      this.watchDevice();
    } catch {
      // A subsequent resize or page reload can retry adapter creation.
    }
  }

  resize(width, height) {
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
  }

  ensureTextures(scene, overlay) {
    const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
    const changed = !this.sceneTexture
      || this.sceneTexture.width !== scene.width || this.sceneTexture.height !== scene.height
      || !this.overlayTexture || this.overlayTexture.width !== overlay.width || this.overlayTexture.height !== overlay.height;
    if (!changed) return;
    this.sceneTexture?.texture.destroy();
    this.overlayTexture?.texture.destroy();
    this.sceneTexture = {
      width: scene.width,
      height: scene.height,
      texture: this.device.createTexture({ size: [scene.width, scene.height], format: 'rgba8unorm', usage }),
    };
    this.overlayTexture = {
      width: overlay.width,
      height: overlay.height,
      texture: this.device.createTexture({ size: [overlay.width, overlay.height], format: 'rgba8unorm', usage }),
    };
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sceneTexture.texture.createView() },
        { binding: 1, resource: this.overlayTexture.texture.createView() },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  present({ scene, overlay, hasOverlay = true, camera, pixelRatio, profile, elapsed = 0, sceneScale = 2 }) {
    if (this.contextLost) return;
    const overlaySource = hasOverlay ? overlay : this.emptyOverlay;
    this.ensureTextures(scene, overlaySource);
    this.device.queue.copyExternalImageToTexture({ source: scene }, { texture: this.sceneTexture.texture }, [scene.width, scene.height]);
    this.device.queue.copyExternalImageToTexture({ source: overlaySource }, { texture: this.overlayTexture.texture }, [overlaySource.width, overlaySource.height]);
    this.uploadedBytes += (scene.width * scene.height + overlaySource.width * overlaySource.height) * 4;
    const uniforms = new Float32Array([
      camera.source.x * sceneScale / scene.width,
      camera.source.y * sceneScale / scene.height,
      camera.source.width * sceneScale / scene.width,
      camera.source.height * sceneScale / scene.height,
      this.canvas.width,
      this.canvas.height,
      scene.width,
      scene.height,
      elapsed,
      profile.modeIndex,
      profile.intensity,
      profile.motionScale,
      profile.tint[0],
      profile.tint[1],
      profile.tint[2],
      profile.vignette,
      profile.power,
      profile.hit,
      profile.reducedMotion ? 1 : 0,
      profile.scanlines,
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.015, g: 0.035, b: 0.048, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setViewport(
      Math.round(camera.viewport.x * pixelRatio),
      Math.round(camera.viewport.y * pixelRatio),
      Math.max(1, Math.round(camera.viewport.width * pixelRatio)),
      Math.max(1, Math.round(camera.viewport.height * pixelRatio)),
      0,
      1,
    );
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.frameCount += 1;
  }

  async finish() { if (!this.contextLost) await this.device.queue.onSubmittedWorkDone(); }

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
    this.destroyed = true;
    this.sceneTexture?.texture.destroy();
    this.overlayTexture?.texture.destroy();
    this.uniformBuffer?.destroy();
    this.device?.destroy();
  }
}

async function initializeWebGPU(canvas, options = {}) {
  const gpu = options.gpu ?? globalThis.navigator?.gpu;
  if (!gpu) return null;
  const adapter = options.adapter ?? await gpu.requestAdapter({ powerPreference: options.powerPreference ?? 'low-power' });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: WEBGPU_SHADER });
  const compilation = await module.getCompilationInfo?.();
  const errors = compilation?.messages?.filter((message) => message.type === 'error') ?? [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join('\n'));
  const format = gpu.getPreferredCanvasFormat();
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const context = canvas.getContext('webgpu');
  if (!context) return null;
  context.configure({ device, format, alphaMode: 'opaque' });
  return { gpu, adapter, device, context, format, pipeline };
}

export async function createWebGPUBackend(canvas, options = {}) {
  const initialized = await initializeWebGPU(canvas, options);
  if (!initialized) return null;
  return new WebGPUPresentationBackend(canvas, initialized.gpu, initialized.adapter, initialized.device, initialized.context, initialized.format, initialized.pipeline);
}
