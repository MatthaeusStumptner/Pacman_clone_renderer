import { chromium } from 'playwright';
import { createServer } from 'vite';

const shouldAssert = process.argv.includes('--assert');
const includeWebGPU = process.argv.includes('--webgpu');
const framesArgument = process.argv.find((value) => value.startsWith('--frames='));
const frames = Number(framesArgument?.split('=')[1]) || 180;
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const address = server.httpServer.address();
const port = typeof address === 'object' ? address.port : 5173;
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const scenarios = [
    { profile: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, cpuRate: 1, quality: 'quality' },
    { profile: 'mobile', viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, cpuRate: 4, quality: 'performance' },
  ];
  const backends = includeWebGPU ? ['canvas2d', 'webgl2', 'webgpu', 'auto'] : ['canvas2d', 'webgl2', 'auto'];
  for (const scenario of scenarios) {
    for (const backend of backends) {
      const context = await browser.newContext({ viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpuRate });
      const url = `http://127.0.0.1:${port}/benchmark.html?backend=${backend}&profile=${scenario.profile}&quality=${scenario.quality}&frames=${frames}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      const result = await page.evaluate(() => window.__RENDER_BENCHMARK__);
      results.push({ ...result, cpuThrottling: scenario.cpuRate, viewport: scenario.viewport });
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
const failures = results.filter((result) => result.requestedBackend === 'auto' && !result.budget.passed);
if (shouldAssert && failures.length) process.exitCode = 1;
