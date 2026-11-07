import { test, expect } from '@playwright/test';
import { a11y, expectNoOverflow, signIn } from './helpers';
import { existsSync } from 'node:fs';

// كل صفحة على 1440 و768 و390، مع فحص الخروج عن الشاشة والقص وaxe، ولقطة كاملة للمراجعة
const widths = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];
const publicPages = [
  { path: '/', slug: 'home' }, { path: '/signin', slug: 'signin' }, { path: '/archive', slug: 'archive' }, { path: '/archive/compare', slug: 'compare' },
  { path: '/this-day/05-25', slug: 'this-day' }, { path: '/write-name', slug: 'write-name' }, { path: '/restoration/madaba-map', slug: 'restoration' }, { path: '/olive', slug: 'olive' },
];
const privatePages = [
  { path: '/studio', slug: 'studio', who: 'admin' as const },
  { path: '/studio/new', slug: 'studio-new', who: 'admin' as const },
  { path: '/admin', slug: 'admin', who: 'admin' as const },
  { path: '/admin/review', slug: 'admin-review', who: 'admin' as const },
  { path: '/admin/items/new', slug: 'admin-new', who: 'admin' as const },
  { path: '/admin/users', slug: 'admin-users', who: 'admin' as const },
  { path: '/admin/settings', slug: 'admin-settings', who: 'admin' as const },
  { path: '/admin/audit', slug: 'admin-audit', who: 'admin' as const },
];
const shots = !!process.env.SHOTS;
const hasCreds = !!process.env.E2E_CREDS && existsSync(process.env.E2E_CREDS);

test.describe.configure({ mode: 'serial' });

for (const w of widths) {
  test.describe(`@${w.name}`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    for (const p of publicPages) {
      test(`${p.slug} @${w.name}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'الأعراض مضبوطة يدوياً');
        await page.goto(p.path);
        await a11y(page);
        if (shots) await page.screenshot({ path: `.shots/${p.slug}-${w.name}.png`, fullPage: p.slug !== 'home' });
        if (p.slug === 'home') {
          // أثناء العبور من القوس وبعده
          for (const [label, frac] of [['mid', 0.45], ['through', 1.05]] as const) {
            await page.evaluate((f) => scrollTo(0, (document.getElementById('window')!.offsetHeight - innerHeight) * f), frac);
            await page.waitForTimeout(250);
            await expectNoOverflow(page);
            if (shots) await page.screenshot({ path: `.shots/home-${label}-${w.name}.png` });
          }
          await page.evaluate(() => scrollTo(0, 0));
          await page.evaluate(() => scrollTo(0, document.getElementById('inside')!.offsetTop));
          await page.waitForTimeout(300);
          if (shots) await page.screenshot({ path: `.shots/home-inside-${w.name}.png`, fullPage: true });
        }
      });
    }

    for (const p of privatePages) {
      test(`${p.slug} @${w.name}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop' || !hasCreds, 'يحتاج حساب اختبار');
        await signIn(page, p.who, '/studio');
        await page.goto(p.path);
        await page.waitForLoadState('networkidle');
        await a11y(page);
        if (shots) await page.screenshot({ path: `.shots/${p.slug}-${w.name}.png`, fullPage: true });
      });
    }
  });
}

test('قائمة الحساب على الجوال: مغلقة افتراضياً، تفتح وتغلق', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !hasCreds, 'يحتاج حساب اختبار');
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'admin', '/admin');
  const btn = page.getByRole('button', { name: 'حسابي' });
  const studio = page.getByRole('banner').getByRole('link', { name: 'مساهماتي' });
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(studio).toBeHidden();
  await btn.click();
  await expect(studio).toBeVisible();
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(studio).toBeHidden();
  // روابط غرفة الأمين قابلة للضغط على الجوال
  await page.getByRole('link', { name: 'طابور المراجعة' }).click();
  await expect(page).toHaveURL(/\/admin\/review/);
});
