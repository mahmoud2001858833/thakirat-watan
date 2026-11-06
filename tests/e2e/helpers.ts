import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// بيانات حسابات الاختبار تأتي من ملف خارج المستودع (E2E_CREDS)، لا تُرفع أبداً
type Cred = { email: string; password: string };
type Who = 'admin' | 'reviewer' | 'contributor';
let cache: Record<Who, Cred> | null = null;
export const creds = (): Record<Who, Cred> => (cache ??= JSON.parse(readFileSync(process.env.E2E_CREDS ?? '', 'utf8')));

export async function signIn(page: Page, who: Who, next = '/studio') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole('button', { name: 'الدخول بكلمة مرور' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(creds()[who].email);
  await page.getByLabel('كلمة المرور').fill(creds()[who].password);
  await page.getByRole('button', { name: 'ادخل', exact: true }).click();
  await page.waitForURL((u) => u.pathname === next);
}

export async function a11y(page: Page) {
  // انتظر انتهاء حركات الظهور حتى يُقاس التباين على الحالة النهائية
  await page.waitForFunction(() => document.getAnimations().every((a) =>
    a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await expectNoOverflow(page);
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

/** لا عنصر يخرج عن عرض الشاشة، ولا نص مقصوص. يتجاهل الزخارف (aria-hidden) وحاويات التمرير المقصودة. */
export async function expectNoOverflow(page: Page) {
  const problems = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    const skip = (el: Element) => {
      for (let p: Element | null = el; p; p = p.parentElement) {
        if (p.getAttribute('aria-hidden') === 'true' || p.classList.contains('sr-only')) return true;
        if (p !== el) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || skip(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (r.left < -1 || r.right > vw + 1) out.push(`outside: ${el.tagName}.${el.className} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent ?? '').trim().slice(0, 30)}"`);
      // نص مقصوص: محتوى أعرض من صندوقه داخل عنصر يخفي الفائض
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 &&
          [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()))
        out.push(`clipped: ${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return out.slice(0, 8);
  });
  expect(problems, problems.join('\n')).toEqual([]);
}
