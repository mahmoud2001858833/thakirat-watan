import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { a11y, signIn, trackErrors } from './helpers';

// تسليم معرّف المادة من اختبار المساهم إلى اختبار المراجع (لكل مشروع على حدة)
const handoff = (project: string) => `test-results/handoff-${project}.txt`;

const stamp = process.env.E2E_RUN ?? 'local';
const title = `اختبار آلي ${stamp}`;

test.describe.configure({ mode: 'serial' });

test('القاعة الأولى: عربية RTL، بلا أخطاء، ووصول AA في الوضعين', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await a11y(page);
  await page.getByRole('button', { name: 'تبديل الوضع الفاتح والداكن' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
  await a11y(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('الزائر يُحوَّل إلى الدخول عند فتح غرفة الأمين', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/signin\?next=%2Fadmin/);
  await a11y(page);
});

test('المساهم: ينشئ مسودة ويضيف مصدراً ويرسلها للمراجعة، ولا يدخل غرفة الأمين', async ({ page }, info) => {
  const errors = trackErrors(page);
  const t = `${title} ${info.project.name}`;
  await signIn(page, 'contributor');
  await page.getByRole('link', { name: 'مادة جديدة' }).click();
  await page.getByLabel('نوع المادة').selectOption('document');
  await page.getByLabel(/^العنوان بالعربية|^العنوان/).first().fill(t);
  await page.getByLabel(/الملخص/).fill('مادة لاختبار مسار المراجعة آلياً، تُحذف بعد الاختبار.');
  await a11y(page);
  await page.getByRole('button', { name: 'احفظ المسودة' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('أُنشئت المسودة');
  mkdirSync('test-results', { recursive: true });
  writeFileSync(handoff(info.project.name), new URL(page.url()).pathname.split('/').pop()!);
  // لا يرى المساهم حقول الطاقم
  await expect(page.getByLabel('درجة التوثيق')).toHaveCount(0);
  await page.getByText('أضف مصدراً').click();
  await page.getByLabel('الاستشهاد الكامل').fill('مصدر اختبار آلي — لا يمثل وثيقة حقيقية');
  await page.getByRole('button', { name: 'أضف المصدر' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('أُضيف المصدر');
  await a11y(page);
  await page.getByRole('button', { name: 'أرسل للمراجعة' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('تغيّرت الحالة');
  await expect(page.getByText('المادة مقفلة للتعديل')).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/\?denied=1/);
  expect(errors).toEqual([]);
});

test('المراجع: لا يوثّق قبل تحديد الدرجة والحقوق، ثم يوثّق وينشر', async ({ page }, info) => {
  const errors = trackErrors(page);
  const t = `${title} ${info.project.name}`;
  const id = readFileSync(handoff(info.project.name), 'utf8').trim();
  await signIn(page, 'reviewer', '/admin');
  await a11y(page);
  await page.getByRole('link', { name: 'طابور المراجعة' }).click();
  await expect(page.getByRole('link', { name: t })).toBeVisible();
  await page.goto(`/admin/items/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t);
  await page.getByRole('button', { name: 'وثّق' }).click();
  await expect(page.locator('.notice[role=alert]')).toContainText('حدّد درجة التوثيق');
  await page.getByLabel('درجة التوثيق').selectOption('circulated_account');
  await page.getByLabel('حقوق الاستخدام').selectOption('cc_by');
  await page.getByRole('button', { name: 'احفظ التعديلات' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('حُفظت');
  await a11y(page);
  await page.getByRole('button', { name: 'وثّق' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('تغيّرت الحالة');
  await page.getByRole('button', { name: 'انشر' }).click();
  await expect(page.locator('.notice[role=status]')).toContainText('تغيّرت الحالة');
  await expect(page.locator('.status-published').first()).toBeVisible();
  // النسخ السابقة محفوظة
  await expect(page.getByRole('heading', { name: 'النسخ السابقة' })).toBeVisible();
  // المراجع ليس مديراً
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/denied=1/);
  expect(errors).toEqual([]);
});

test('المدير: الإعدادات وسجل التدقيق والمستخدمون', async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page, 'admin', '/admin');
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  const btn = page.getByRole('button', { name: /المساعد/ });
  const before = await btn.textContent();
  await btn.click();
  await expect(page.locator('.notice[role=status]')).toContainText('حُفظت الإعدادات');
  await expect(page.getByRole('button', { name: /المساعد/ })).not.toHaveText(before!);
  await page.getByRole('button', { name: /المساعد/ }).click(); // إعادة الحالة
  await a11y(page);
  await page.getByRole('link', { name: 'سجل التدقيق' }).click();
  await expect(page.getByRole('cell', { name: 'تغيير حالة' }).first()).toBeVisible();
  await a11y(page);
  await page.getByRole('link', { name: 'المستخدمون والأدوار' }).click();
  await expect(page.getByRole('cell', { name: 'e2e-contrib@example.com' })).toBeVisible();
  await a11y(page);
  expect(errors).toEqual([]);
});
