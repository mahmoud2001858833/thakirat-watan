import { test, expect } from '@playwright/test';

// الأداء مع عشرة آلاف ورقة على جوال بمعالج مبطّأ ×4. يُشغَّل يدوياً: PERF=1
test('زيتونة الوطن سلسة مع 10,000 ورقة على الجوال', async ({ page }, info) => {
  test.skip(!process.env.PERF || info.project.name !== 'mobile', 'اختبار أداء يدوي');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto('/olive');
  await expect(page.getByTestId('leaf-count')).toContainText(/١٠٬?٠/, { timeout: 30000 });
  await page.waitForResponse((r) => r.url().includes('/api/olive/leaves')).catch(() => {});
  await expect(page.getByText('تُحمَّل الأوراق…')).toHaveCount(0, { timeout: 30000 });
  const ready = Date.now() - t0;
  const c = page.getByTestId('olive-canvas'); await c.scrollIntoViewIfNeeded();
  const box = (await c.boundingBox())!;
  // نقيس أزمنة الإطارات أثناء السحب والتكبير
  await page.evaluate(() => { (window as unknown as { __f: number[] }).__f = []; let last = performance.now();
    const loop = (t: number) => { (window as unknown as { __f: number[] }).__f.push(t - last); last = t; if ((window as unknown as { __f: number[] }).__f.length < 400) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 40; i++) await page.mouse.move(box.x + box.width / 2 + Math.sin(i / 6) * 120, box.y + box.height / 2 + i * 2, { steps: 2 });
  await page.mouse.up();
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -60);
  const f = await page.evaluate(() => (window as unknown as { __f: number[] }).__f.slice(5));
  const sorted = [...f].sort((a, b) => a - b), p50 = sorted[Math.floor(sorted.length / 2)], p95 = sorted[Math.floor(sorted.length * 0.95)];
  console.log(`PERF ready=${ready}ms frames=${f.length} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  expect(p50).toBeLessThan(34); // ≥ 30 إطاراً في الثانية في المعتاد، على معالج مبطّأ أربع مرات
});
