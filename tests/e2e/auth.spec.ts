import { test, expect } from '@playwright/test';

// اختبار الدخول بالبريد على الموقع المنشور. خادم البريد لا يرسل لعناوين الاختبار،
// فيُجهَّز الرمز في قاعدة البيانات كما يجهزه Supabase تماماً (AUTH_OTP و AUTH_HASH من خارج المستودع).
const email = 'e2e-link@example.com';
test.describe.configure({ mode: 'serial' });

test('الدخول بالرمز المكوّن من ستة أرقام', async ({ page }, info) => {
  test.skip(!process.env.AUTH_OTP || info.project.name !== 'desktop', 'يحتاج رمزاً مجهزاً');
  await page.goto('/signin?next=/studio');
  await page.getByRole('button', { name: 'لديّ رمز دخول' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel(/رمز الدخول/).fill(process.env.AUTH_OTP!);
  await page.getByRole('button', { name: 'ادخل بالرمز' }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole('heading', { name: 'مساهماتي' })).toBeVisible();
});

test('الدخول برابط البريد الجديد (token_hash) من أي جهاز', async ({ page }, info) => {
  test.skip(!process.env.AUTH_HASH || info.project.name !== 'mobile', 'يحتاج رابطاً مجهزاً');
  await page.goto(`/auth/confirm?token_hash=${process.env.AUTH_HASH}&type=email&next=/studio`);
  // فتح الرابط وحده لا يستهلكه (حماية من برامج فحص الروابط)، الضغط هو ما يكمل الدخول
  await page.getByRole('button', { name: 'أكمل الدخول' }).click();
  await expect(page).toHaveURL(/\/studio$/);
});

test('رابط قديم يعطي رسالة واضحة', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'مرة واحدة');
  await page.goto('/auth/confirm?token_hash=pkce_00000000000000000000000000000000&type=email');
  await page.getByRole('button', { name: 'أكمل الدخول' }).click();
  await expect(page.locator('.notice[role=alert]')).toContainText('أحدث رسالة');
});
