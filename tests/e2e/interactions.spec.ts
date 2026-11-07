import { test, expect, type Page } from '@playwright/test';
import { a11y, expectNoOverflow, trackErrors } from './helpers';

// التفاعل في كل قاعة: يعمل بالفأرة على الكمبيوتر وباللمس على الجوال
test.describe.configure({ mode: 'serial' });
const num = (s: string | null) => Number((s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d]/g, ''));

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, touch: boolean) {
  if (!touch) {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
    return;
  }
  // لمس حقيقي عبر بروتوكول DevTools (Pixel 7)
  const cdp = await page.context().newCDPSession(page);
  const pt = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('الأرشيف: شريط زمني يُسحب، وفاجئني، والمقارنة، والتكبير العميق', async ({ page }, info) => {
  const touch = info.project.name === 'mobile';
  const errors = trackErrors(page);
  await page.goto('/archive');
  const total = await page.getByTestId('wall').locator('> li').count();
  expect(total).toBeGreaterThanOrEqual(40);
  // سحب طرف النافذة يضيّق الزمن ويقلّل المواد المعروضة
  const tl = page.getByTestId('timeline'); await tl.scrollIntoViewIfNeeded();
  const tb = (await tl.boundingBox())!;
  const h = page.getByRole('slider', { name: 'بداية النافذة (الأقدم)' });
  const hb = center((await h.boundingBox())!);
  await drag(page, hb, { x: tb.x + tb.width * 0.45, y: hb.y }, touch);
  await expect(page.getByTestId('tl-range')).not.toContainText('كل العصور');
  const fewer = await page.getByTestId('wall').locator('> li').count();
  expect(fewer).toBeLessThan(total);
  // لوحة المفاتيح: Home يعيد كل العصور
  await h.focus(); await page.keyboard.press('Home');
  await expect(page.getByTestId('tl-range')).toContainText('كل العصور');
  await a11y(page);

  // اختيار مادتين للمقارنة
  await page.getByTestId('pick').nth(0).click();
  await page.getByTestId('pick').nth(3).click();
  await page.getByTestId('go-compare').click();
  await expect(page).toHaveURL(/\/archive\/compare\?a=.+&b=.+/);
  await expect(page.getByTestId('zoom-stage')).toHaveCount(2);
  await page.getByTestId('zoom-stage').first().focus();
  await page.keyboard.press('+');
  await expect(page.getByTestId('zoom-pct').first()).not.toHaveText('١٠٠٪');
  await expect(page.getByTestId('zoom-pct').nth(1)).not.toHaveText('١٠٠٪'); // متزامنتان
  await a11y(page);

  // فاجئني يفتح مادة
  await page.goto('/archive');
  await page.getByTestId('surprise').click();
  await page.waitForURL(/\/archive\/[0-9a-f-]{36}$/);

  // التكبير العميق: قرص أو عجلة، وسحب للتحريك
  await page.getByTestId('deep-zoom').click();
  const st = page.getByTestId('zoom-stage');
  await expect(st).toBeVisible();
  await page.getByRole('button', { name: 'تكبير', exact: true }).click();
  await page.getByRole('button', { name: 'تكبير', exact: true }).click();
  expect(num(await page.getByTestId('zoom-pct').textContent())).toBeGreaterThan(200);
  const layer = st.locator('> div');
  const before = await layer.evaluate((el) => getComputedStyle(el).transform);
  const sb = center((await st.boundingBox())!);
  await drag(page, sb, { x: sb.x - 120, y: sb.y - 60 }, touch);
  expect(await layer.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('هذا اليوم: الصفحة تُقلَّب بالسحب، والدولاب يختار التاريخ، واختبر نفسك', async ({ page }, info) => {
  const touch = info.project.name === 'mobile';
  const errors = trackErrors(page);
  await page.goto('/this-day/05-25');
  await expect(page.getByTestId('book').getByRole('heading', { level: 2 })).toHaveText('استقلال المملكة');
  const bk = (await page.getByTestId('book').boundingBox())!;
  // من اليسار إلى اليمين = الصفحة التالية
  await drag(page, { x: bk.x + 20, y: bk.y + 260 }, { x: bk.x + bk.width * 0.85, y: bk.y + 270 }, touch);
  await expect(page).not.toHaveURL(/05-25$/);
  await expect(page.getByTestId('book').getByRole('heading', { level: 2 })).not.toHaveText('استقلال المملكة');
  // الأزرار ترجع
  await page.getByRole('button', { name: /الصفحة السابقة/ }).click();
  await expect(page).toHaveURL(/05-25$/);

  // الدولاب: الأسهم تدير الحلقة، والزر يفتح الصفحة
  await page.getByTestId('dial-toggle').click();
  await page.getByRole('slider', { name: 'الشهر' }).focus();
  await page.keyboard.press('ArrowUp'); // الشهر السابق
  await page.getByRole('slider', { name: 'اليوم' }).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('dial-go')).toContainText('٢٨ نيسان');
  await a11y(page);
  await page.getByTestId('dial-go').click();
  await expect(page).toHaveURL(/04-28$/);

  // اختبر نفسك
  await page.goto('/this-day/05-25');
  await page.locator('[data-testid="quiz-opt"][data-correct="true"]').click();
  await expect(page.getByTestId('quiz-score')).toHaveText('١ من ١');
  await page.getByTestId('quiz-next').click();
  await page.locator('[data-testid="quiz-opt"][data-correct="false"]').first().click();
  await expect(page.getByTestId('quiz-score')).toHaveText('١ من ٢');
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('اكتب اسمك: الحروف تُنقش واحداً واحداً، والضوء يتبع المؤشر', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/write-name');
  const stone = page.getByTestId('stone');
  await stone.scrollIntoViewIfNeeded();
  await expect(stone).toHaveAttribute('data-carving', 'true');
  const mid = await stone.screenshot();
  await expect(stone).toHaveAttribute('data-carving', 'false', { timeout: 10_000 });
  const done = await stone.screenshot();
  expect(mid.equals(done)).toBe(false);
  // تحريك الضوء يغيّر الإضاءة
  const b = (await stone.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.9);
  await page.waitForTimeout(700);
  expect((await stone.screenshot()).equals(done)).toBe(false);
  await page.getByRole('button', { name: 'انقش من جديد' }).click();
  await expect(stone).toHaveAttribute('data-carving', 'true');
  expect(errors).toEqual([]);
});

test('مختبر الترميم: القطع تُسحب فعلاً، والعدّاد يعمل، ولوحة أفضل الأزمنة ظاهرة', async ({ page }, info) => {
  const touch = info.project.name === 'mobile';
  const errors = trackErrors(page);
  await page.goto('/restoration');
  await page.getByRole('link', { name: /خارطة مادبا/ }).click();
  await expect(page.getByRole('heading', { name: 'أفضل الأزمنة' })).toBeVisible();
  // اسحب القطعة الصحيحة لأول موضع خاطئ إلى مكانها
  const n = await page.locator('[data-pos]').count();
  let target = -1;
  for (let p = 0; p < n; p++) if ((await page.locator(`[data-pos="${p}"]`).getAttribute('data-piece')) !== String(p)) { target = p; break; }
  const from = page.locator(`[data-piece="${target}"]`), to = page.locator(`[data-pos="${target}"]`);
  const before = num(await page.getByTestId('correct').textContent());
  await from.scrollIntoViewIfNeeded();
  await drag(page, center((await from.boundingBox())!), center((await to.boundingBox())!), touch);
  await expect(page.locator(`[data-pos="${target}"]`)).toHaveAttribute('data-piece', String(target));
  expect(num(await page.getByTestId('correct').textContent())).toBeGreaterThan(before);
  await page.waitForTimeout(1300);
  expect(num(await page.getByTestId('timer').textContent())).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('زيتونة الوطن: الأوراق تتحرك مع الريح، واللمس يفتح الذكرى', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/olive');
  const c = page.getByTestId('olive-canvas');
  await expect(page.getByTestId('leaf-list').locator('button').first()).toBeVisible();
  const a = await c.screenshot(); await page.waitForTimeout(600);
  expect((await c.screenshot()).equals(a)).toBe(false);
  await page.getByTestId('leaf-list').locator('button').first().click();
  await expect(page.getByTestId('leaf-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'أغلق' }).click();
  await expect(page.getByTestId('leaf-sheet')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('الأصوات: زر الكتم يحفظ الاختيار', async ({ page }) => {
  await page.goto('/archive');
  const btn = page.getByRole('button', { name: 'كتم الأصوات' });
  await btn.click();
  await expect(page.getByRole('button', { name: 'تشغيل الأصوات' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'تشغيل الأصوات' })).toBeVisible();
});
