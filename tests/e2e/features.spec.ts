import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { a11y, expectNoOverflow, signIn, trackErrors } from './helpers';

const hasCreds = !!process.env.E2E_CREDS && existsSync(process.env.E2E_CREDS);
test.describe.configure({ mode: 'serial' });

test('الأرشيف: أربعون مادة على الأقل، وبحث يتجاوز التاء المربوطة، وفلتر المحافظة', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/archive');
  await expect(page.locator('a[href^="/archive/"]').first()).toBeVisible();
  expect(await page.locator('ul li a[href^="/archive/"]').count()).toBeGreaterThanOrEqual(40);
  await a11y(page);
  await page.getByLabel(/ابحث في الأرشيف/).fill('قلعه');
  await page.getByRole('button', { name: 'اعرض' }).click();
  await expect(page.getByText('قلعة عجلون على قمة الجبل')).toBeVisible();
  await expect(page.getByText('قلعة الكرك')).toBeVisible();
  await page.goto('/archive?place=ajloun');
  const titles = await page.locator('ul li a[href^="/archive/"] span').allTextContents();
  expect(titles.join(' ')).toContain('عجلون');
  expect(titles.join(' ')).not.toContain('الكرك');
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('صفحة المادة: الصورة بإسنادها، ودرجة التوثيق، والمصادر، والبلاغ', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/archive?q=%D8%A7%D9%84%D8%AE%D8%B2%D9%86%D8%A9');
  await page.getByRole('link', { name: /الخزنة في البترا/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('الخزنة في البترا');
  await expect(page.getByText('قيد المراجعة').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Diego Delso/ }).first()).toHaveAttribute('href', /commons\.wikimedia\.org/);
  expect(await page.locator('ol li a[href*="wikipedia.org"], ol li a[href*="wikimedia.org"]').count()).toBeGreaterThanOrEqual(2);
  await a11y(page);
  await page.getByText('بلّغ عن خطأ في هذه المادة').click();
  await page.getByLabel('التفاصيل والمصدر إن وُجد').fill(`اختبار آلي ${process.env.E2E_RUN ?? ''}`);
  await page.getByRole('button', { name: 'أرسل البلاغ' }).click();
  await expect(page.getByText('وصل بلاغك إلى الأمين')).toBeVisible();
  expect(errors).toEqual([]);
});

test('هذا اليوم: 25 أيار يحمل الاستقلال، ويوم بلا أحداث يقترح أقرب الأيام', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/this-day/05-25');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('استقلال المملكة');
  await expect(page.getByText('بريطانيا تعترف بحكومة مستقلة في شرق الأردن')).toBeVisible();
  await expect(page.getByRole('link', { name: /ويكيبيديا/ }).first()).toHaveAttribute('href', /wikipedia\.org/);
  await a11y(page);
  await expectNoOverflow(page);
  await page.goto('/this-day/01-03');
  await expect(page.getByText('لا توجد أحداث موثقة لهذا اليوم بعد.')).toBeVisible();
  await page.locator('[class*="near"] a').first().click();
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await page.goto('/this-day/02-31');
  await expect(page.getByRole('heading', { name: 'لم نجد هذه الصفحة في الأرشيف' })).toBeVisible();
  await page.goto('/this-day');
  await expect(page).toHaveURL(/\/this-day\/\d{2}-\d{2}$/);
  expect(errors).toEqual([]);
});

test('اكتب اسمك: حروف صحيحة من الجدول، وبطاقة تُنزَّل', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/write-name');
  await page.getByLabel(/اسمك بالعربية/).fill('محمد');
  // الصفوي: م ح م د = MEEM HAH MEEM DAL
  await expect(page.getByTestId('glyphs')).toHaveText('\u{10A83}\u{10A82}\u{10A83}\u{10A95}');
  await page.getByRole('tab', { name: /النبطي/ }).click();
  await expect(page.getByTestId('glyphs')).toHaveText('\u{10893}\u{1088A}\u{10893}\u{10885}');
  await page.getByLabel(/اسمك بالعربية/).fill('سلمى');
  await page.getByRole('tab', { name: /المؤابي/ }).click();
  // س ل م (والألف المقصورة صوت ممدود لا يُكتب)
  await expect(page.getByTestId('glyphs')).toHaveText('\u{1090E}\u{1090B}\u{1090C}');
  await expect(page.getByText('صوت ممدود لم يُكتب غالباً')).toBeVisible();
  await a11y(page);
  await expectNoOverflow(page);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'احفظ البطاقة' }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.png$/);
  await page.getByLabel(/اسمك بالعربية/).fill('abc');
  await expect(page.locator('#name-err')).toContainText('حروف عربية');
  expect(errors).toEqual([]);
});

test('مختبر الترميم: تكتمل اللوحة وتنفتح خطوات المرممين وتُسجَّل', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/restoration');
  await a11y(page);
  await page.getByRole('link', { name: /خارطة مادبا/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('خارطة مادبا');
  await a11y(page);
  // حل اللوحة: لكل موضع، اختر القطعة الصحيحة وبدّلها معه
  const n = await page.locator('[data-pos]').count();
  for (let p = 0; p < n; p++) {
    const at = await page.locator(`[data-pos="${p}"]`).getAttribute('data-piece');
    if (Number(at) === p) continue;
    await page.locator(`[data-pos="${p}"]`).click();
    await page.locator(`[data-piece="${p}"]`).click();
  }
  await expect(page.getByTestId('solved')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الحماية والمراقبة' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Getty/ }).first()).toHaveAttribute('href', /getty\.edu/);
  // لوحة المفاتيح: الأسهم تنقل التركيز
  await page.getByRole('button', { name: 'اخلط من جديد' }).click();
  await page.locator('[data-pos="0"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-pos="1"]')).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
  await expect(page.getByText(/بدّلت القطعتين/)).toBeVisible();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('زيتونة الوطن للزائر: العداد من القاعدة، والقائمة البديلة، وفتح الورقة', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/olive');
  await expect(page.getByTestId('olive-canvas')).toBeVisible();
  const n = Number((await page.getByTestId('leaf-count').textContent())!.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, ''));
  expect(n).toBeGreaterThanOrEqual(30);
  await expect(page.getByTestId('leaf-list').locator('button').first()).toBeVisible();
  await page.getByTestId('leaf-list').locator('button').filter({ hasText: 'مثل شعبي' }).first().click();
  await expect(page.getByTestId('leaf-sheet')).toContainText('تجريبي');
  await a11y(page);
  await expectNoOverflow(page);
  // فلتر المحافظة يغيّر العداد
  await page.locator('#f-gov').selectOption({ label: 'عجلون' });
  await expect(page.getByTestId('leaf-count')).not.toHaveText(String(n));
  // الضغط على ورقة في الرسم يفتحها (نختار مركز ورقة معروفة من الرسم)
  await page.getByRole('button', { name: 'أغلق' }).click();
  await expect(page.getByText('لتضيف ورقة')).toBeVisible();
  expect(errors).toEqual([]);
});

test('زيتونة الوطن: ورقة جديدة برعم لصاحبها، ثم تنشرها المراجعة', async ({ browser }, info) => {
  test.setTimeout(120_000);
  test.skip(!hasCreds, 'يحتاج حسابات اختبار');
  const body = `ورقة اختبار آلي ${info.project.name} ${process.env.E2E_RUN ?? ''}`;
  const user = await (await browser.newContext({ ...info.project.use })).newPage();
  await signIn(user, 'contributor', '/olive');
  await user.getByLabel(/ذكرى أو مثل/).fill(body);
  await user.getByLabel('محافظتك').selectOption({ label: 'إربد' });
  await user.getByLabel(/اسمك الأول/).fill('سامي الكامل');
  await user.getByRole('button', { name: 'انثر الورقة' }).click();
  await expect(user.getByText('نبتت ورقتك برعماً')).toBeVisible();
  // الزائر لا يراها
  const anon = await (await browser.newContext({ ...info.project.use })).newPage();
  await anon.goto('/olive');
  await expect(anon.getByTestId('leaf-list')).not.toContainText(body);
  // المدير ينشرها
  const admin = await (await browser.newContext({ ...info.project.use })).newPage();
  await signIn(admin, 'admin', '/admin/olive');
  const row = admin.getByRole('row').filter({ hasText: body });
  await expect(row).toContainText('سامي');
  await expect(row).not.toContainText('الكامل');
  await row.getByRole('button', { name: 'انشرها' }).click();
  await expect(admin.getByRole('row').filter({ hasText: body })).toHaveCount(0);
  // تظهر للزائر، ولها صفحة مشاركة بالذكرى فقط
  // ذاكرة الشبكة القصيرة (10 ثوانٍ) قد تؤخر الظهور قليلاً
  await expect(async () => {
    await anon.reload();
    await anon.locator('#f-gov').selectOption({ label: 'إربد' });
    await expect(anon.getByTestId('leaf-list')).toContainText(body, { timeout: 4000 });
  }).toPass({ timeout: 45000, intervals: [2000, 4000, 6000] });
  await anon.getByTestId('leaf-list').getByText(body).click();
  await anon.getByTestId('leaf-sheet').getByRole('link', { name: 'رابط هذه الورقة' }).click();
  await expect(anon.locator('blockquote')).toHaveText(body);
  await expect(anon.locator('article')).not.toContainText('سامي');
  // إحصاءات الترميم وصلت إلى غرفة الأمين
  await admin.goto('/admin/mosaics');
  await expect(admin.getByTestId('completions-madaba-map')).not.toHaveText('٠');
});
