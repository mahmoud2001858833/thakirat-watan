import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// بيانات حسابات الاختبار تأتي من ملف خارج المستودع (E2E_CREDS)، لا تُرفع أبداً
type Cred = { email: string; password: string };
export const creds: Record<'admin' | 'reviewer' | 'contributor', Cred> =
  JSON.parse(readFileSync(process.env.E2E_CREDS ?? '', 'utf8'));

export async function signIn(page: Page, who: keyof typeof creds, next = '/studio') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole('button', { name: 'الدخول بكلمة مرور' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(creds[who].email);
  await page.getByLabel('كلمة المرور').fill(creds[who].password);
  await page.getByRole('button', { name: 'ادخل', exact: true }).click();
  await page.waitForURL((u) => u.pathname === next);
}

export async function a11y(page: Page) {
  // انتظر انتهاء حركات الظهور حتى يُقاس التباين على الحالة النهائية
  await page.waitForFunction(() => document.getAnimations().every((a) =>
    a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  // لا تمرير أفقي للصفحة على أي عرض
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return false; // داخل حاوية تمرير مقصودة (جداول)
      }
      return r.left < -1 || r.right > vw + 1;
    }).slice(0, 3).map((el) => el.outerHTML.slice(0, 120));
  });
  expect(overflow, 'elements outside the viewport').toEqual([]);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const msg = r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`).join('\n');
  expect(r.violations, msg).toEqual([]);
}

export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
