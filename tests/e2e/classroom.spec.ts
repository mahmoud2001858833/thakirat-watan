import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { devices } from '@playwright/test';
import { a11y, trackErrors } from './helpers';

// الميزات التشاركية من البداية إلى النهاية على الموقع المنشور:
// مدرستان (إربد والعقبة)، ومعلمان، وأربعة طلاب في متصفحات منفصلة. الحسابات من E2E_CLASS (ملف خارج المستودع).
type C = { teacherA: { email: string; password: string }; teacherB: { email: string; password: string } };
const file = process.env.E2E_CLASS ?? '';
const has = !!file && existsSync(file);
const creds = (): C => JSON.parse(readFileSync(file, 'utf8'));
const run = process.env.E2E_RUN ?? String(Date.now());
const video = process.env.E2E_VIDEO; // مجلد لحفظ فيديو الجلسة المباشرة
test.describe.configure({ mode: 'serial' });
test.skip(!has, 'يحتاج E2E_CLASS');
test.setTimeout(240_000);

const st: { codes: string[]; classA?: string; classB?: string; twin?: string; live?: string; code?: string } = { codes: [] };
const ctxs: BrowserContext[] = [];
async function open(browser: Browser, phone = false, rec?: string) {
  const c = await browser.newContext({ ...(phone ? devices['Pixel 7'] : { viewport: { width: 1366, height: 860 } }), locale: 'ar-JO', baseURL: test.info().project.use.baseURL,
    ...(rec ? { recordVideo: { dir: rec, size: phone ? { width: 412, height: 860 } : { width: 1366, height: 860 } } } : {}) });
  ctxs.push(c); return c.newPage();
}
async function teacher(page: Page, who: 'teacherA' | 'teacherB') {
  await page.goto('/signin?next=/teach');
  await page.getByRole('button', { name: 'الدخول بكلمة مرور' }).click();
  await page.getByLabel('البريد الإلكتروني').fill(creds()[who].email);
  await page.getByLabel('كلمة المرور').fill(creds()[who].password);
  await page.getByRole('button', { name: 'ادخل', exact: true }).click();
  await page.waitForURL(/\/teach$/);
}
async function student(page: Page, code: string) {
  await page.goto('/signin?student=1');
  await page.getByLabel('رمز الدخول').fill(code);
  await page.getByRole('button', { name: 'ادخل إلى صفي' }).click();
  await page.waitForURL(/\/class$/);
}
test.afterAll(async () => { for (const c of ctxs) await c.close().catch(() => {}); });

let A: Page, B: Page, s1: Page, s2: Page, s3: Page, s4: Page;

test('المعلمان ينشئان صفين، ويضيفان أربعة طلاب بأسماء مستعارة ورموز', async ({ browser }) => {
  A = await open(browser); B = await open(browser);
  for (const [p, who, name] of [[A, 'teacherA', `إربد ${run}`], [B, 'teacherB', `العقبة ${run}`]] as const) {
    const errors = trackErrors(p);
    await teacher(p, who);
    await p.getByLabel('اسم الصف').fill(name);
    await p.getByLabel('الصف الدراسي').fill('7');
    await p.getByRole('button', { name: 'أنشئ الصف' }).click();
    await p.waitForURL(/\/teach\/[0-9a-f-]{36}$/);
    await p.getByRole('button', { name: 'اقترح ٥ أسماء' }).click();
    const names = (await p.getByLabel(/الأسماء المستعارة/).inputValue()).split('\n').slice(0, 2).join('\n');
    await p.getByLabel(/الأسماء المستعارة/).fill(names);
    await p.getByRole('button', { name: 'أنشئ الحسابات' }).click();
    const codes = p.getByTestId('codes').locator('code');
    await expect(codes).toHaveCount(2);
    st.codes.push(...(await codes.allTextContents()));
    await a11y(p);
    if (who === 'teacherA') st.classA = p.url().split('/').pop(); else st.classB = p.url().split('/').pop();
    await p.getByRole('button', { name: 'افتح صفي للتوأمة' }).click();
    await expect(p.getByRole('button', { name: 'أخفِ صفي من الدليل' })).toBeVisible();
    expect(errors).toEqual([]);
  }
  expect(st.codes).toHaveLength(4);
  for (const c of st.codes) expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{6}$/);
});

test('التوأمة: معلم العقبة يطلب، ومعلم إربد يقبل، والطلاب يدخلون برموزهم', async ({ browser }) => {
  await B.goto(`/teach/${st.classB}#twin`);
  await B.getByRole('listitem').filter({ hasText: 'إربد' }).filter({ has: B.getByRole('button', { name: 'اطلب التوأمة' }) }).first().getByRole('button', { name: 'اطلب التوأمة' }).click();
  await expect(B.getByText('أرسلت طلب التوأمة')).toBeVisible();
  await A.goto(`/teach/${st.classA}#twin`);
  await A.getByRole('button', { name: 'اقبل التوأمة' }).first().click();
  await A.waitForURL(/\/twin\/[0-9a-f-]{36}$/);
  st.twin = A.url().split('/').pop();
  s1 = await open(browser, true); s2 = await open(browser, true); s3 = await open(browser, true); s4 = await open(browser, true);
  for (const [p, c] of [[s1, st.codes[0]], [s2, st.codes[1]], [s3, st.codes[2]], [s4, st.codes[3]]] as const) await student(p, c);
  await expect(s1.getByText(/صندوق الرسائل مع/)).toBeVisible();
  await a11y(s1);
});

test('صندوق الرسائل: سؤال بصورة يمر بمعلم الكاتب، ثم يضيء الخط عند الصف التوأم', async () => {
  await s1.goto(`/twin/${st.twin}`);
  await s3.goto(`/twin/${st.twin}`);
  await s1.getByLabel(/سؤالكم عن بلدتهم/).fill(`ما أشهر أكلة في العقبة؟ (${run})`);
  // صورة صغيرة يولّدها المتصفح نفسه (لا ملفات من الإنترنت)
  const jpg = await s1.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d')!;
    g.fillStyle = '#c4836f'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#2a2420'; g.fillRect(10, 10, 20, 20);
    const b: Blob = await new Promise((r) => c.toBlob((x) => r(x!), 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await s1.locator('input[type=file]').setInputFiles({ name: 'souq.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg) });
  await expect(s1.getByAltText('الصورة المختارة')).toBeVisible();
  await s1.getByTestId('send').click();
  await expect(s1.getByText('وصلت رسالتك إلى معلمك')).toBeVisible();
  await expect(s1.locator('[data-status="pending"]').filter({ hasText: run })).toBeVisible();
  // الصف التوأم وزميل الكاتب لا يرونها قبل المراجعة
  await s3.reload(); await expect(s3.getByText(run)).toHaveCount(0);
  await s2.goto(`/twin/${st.twin}`); await expect(s2.getByText(run)).toHaveCount(0);
  await B.goto(`/twin/${st.twin}`); await expect(B.getByText(run)).toHaveCount(0);
  // المعلم يوافق، فيصل إلى الصف التوأم لحظياً
  await A.goto(`/twin/${st.twin}`);
  await A.getByTestId('approve').first().click();
  await expect(s3.locator('[data-status="approved"]').filter({ hasText: run })).toBeVisible({ timeout: 20_000 });
  await expect(s3.locator('[data-status="approved"]').filter({ hasText: run }).locator('img')).toBeVisible();
  // الجواب من العقبة يمر بمعلمها
  await s3.getByTestId('reply').first().click();
  await s3.getByLabel(/جوابكم/).fill(`الصيادية: سمك وأرز وبصل محروق (${run})`);
  await s3.getByTestId('send').click();
  await expect(s3.getByText('وصلت رسالتك إلى معلمك')).toBeVisible();
  await s1.reload(); await expect(s1.getByText(`الصيادية: سمك وأرز وبصل محروق (${run})`)).toHaveCount(0);
  await B.reload(); await B.getByTestId('approve').first().click();
  await expect(s1.getByText(`الصيادية: سمك وأرز وبصل محروق (${run})`)).toBeVisible({ timeout: 20_000 });
  await a11y(s1);
});

test('الجلسة المباشرة: المعلم يعرض صورة، والطلاب يصوّتون ويجيبون ويضعون إشارات، والنتائج تظهر لحظياً', async ({ browser }) => {
  // فيديو قصير: شاشة الصف وجوالا طالبين
  const dir = video ? `${video}/${run}` : undefined;
  if (dir) mkdirSync(dir, { recursive: true });
  const screen = dir ? await open(browser, false, `${dir}/screen`) : A;
  if (dir) await teacher(screen, 'teacherA');
  const p1 = dir ? await open(browser, true, `${dir}/phone1`) : s1, p2 = dir ? await open(browser, true, `${dir}/phone2`) : s2;
  if (dir) { await student(p1, st.codes[0]); await student(p2, st.codes[1]); }
  await screen.goto(`/teach/${st.classA}#live`);
  await screen.getByTestId('open-live').click();
  await screen.waitForURL(/\/live\/[0-9a-f-]{36}$/);
  st.live = screen.url().split('/').pop();
  const code = (await screen.getByTestId('live-code').textContent())!.replace(/\D/g, '');
  expect(code).toMatch(/^\d{6}$/);
  // طالب من صف آخر لا يدخل
  await s3.goto('/join'); await s3.getByLabel('رمز الجلسة').fill(code); await s3.getByRole('button', { name: 'ادخل' }).click();
  await expect(s3.getByText('لم نجد جلسة مفتوحة لصفك بهذا الرمز')).toBeVisible();
  for (const p of [p1, p2]) {
    await p.goto('/join'); await p.getByLabel('رمز الجلسة').fill(code); await p.getByRole('button', { name: 'ادخل' }).click();
    await p.waitForURL(/\/play$/);
  }
  await screen.getByRole('button', { name: 'شاشة الصف' }).click();
  // السؤال الأول: إشارات على الصورة
  for (const [p, xs] of [[p1, [0.3, 0.6]], [p2, [0.5]]] as const) {
    const pic = p.getByTestId('live-picture'); const b = (await pic.boundingBox())!;
    for (const x of xs) { await p.mouse.click(b.x + b.width * x, b.y + b.height * 0.4); await p.waitForTimeout(400); }
  }
  await expect(screen.getByTestId('answered')).toContainText('٢ / ٢', { timeout: 15_000 });
  await expect(screen.locator('[data-testid="live-picture"] span')).toHaveCount(3, { timeout: 15_000 });
  await screen.waitForTimeout(1200);
  // السؤال الثاني: تصويت
  await screen.getByTestId('next-act').click();
  await expect(p1.getByTestId('live-choice').first()).toBeVisible({ timeout: 15_000 });
  await p1.getByTestId('live-choice').nth(0).click(); await expect(p1.getByTestId('live-sent')).toBeVisible();
  await p2.getByTestId('live-choice').nth(2).click(); await expect(p2.getByTestId('live-sent')).toBeVisible();
  await expect(screen.getByTestId('answered')).toContainText('٢ / ٢', { timeout: 15_000 });
  await screen.getByTestId('reveal').click();
  await expect(screen.getByTestId('bar-n').nth(0)).toHaveText('١');
  await expect(screen.getByTestId('bar-n').nth(2)).toHaveText('١');
  await expect(p1.getByTestId('bar-n').nth(0)).toHaveText('١', { timeout: 15_000 });
  await screen.waitForTimeout(1500);
  // السؤال الثالث: نص لا يظهر قبل موافقة المعلم
  await screen.getByTestId('next-act').click();
  await p1.getByLabel(/جوابك/).fill('من نحت هذه الحجارة وكم سنة استغرق؟');
  await p1.getByTestId('live-send').click(); await expect(p1.getByTestId('live-sent')).toBeVisible();
  await screen.getByRole('button', { name: 'لوحة المعلم' }).click();
  await expect(screen.getByTestId('moderation')).toContainText('من نحت هذه الحجارة', { timeout: 15_000 });
  await screen.getByTestId('reveal').click();
  await expect(screen.getByTestId('screen-texts')).not.toContainText('من نحت هذه الحجارة');
  await screen.getByTestId('show-text').first().click();
  await expect(screen.getByTestId('screen-texts')).toContainText('من نحت هذه الحجارة');
  await screen.getByRole('button', { name: 'شاشة الصف' }).click();
  await screen.waitForTimeout(1500);
  await expect(p2.getByTestId('screen-texts')).toContainText('من نحت هذه الحجارة', { timeout: 15_000 });
  screen.once('dialog', (d) => d.accept());
  await screen.getByRole('button', { name: 'لوحة المعلم' }).click();
  await screen.getByRole('button', { name: 'أنهِ الجلسة' }).click();
  await expect(p1.getByText('انتهت الجلسة')).toBeVisible({ timeout: 15_000 });
});

test('الفسيفساء الكبرى: كل صف يتبنى جزءاً، والزملاء يرون القطع تتحرك مباشرة، ثم تكتمل اللوحة', async () => {
  const claim = async (p: Page, cls: string) => {
    await p.goto(`/teach/${cls}#grand`);
    await p.getByRole('button', { name: /تبنَّ جزءاً من «فسيفساء الاختبار» \(تجريبي\)/ }).click();
    await p.waitForURL(/\/grand\/[0-9a-f-]{36}$/);
    return p.url().split('/').pop()!;
  };
  const secA = await claim(A, st.classA!), secB = await claim(B, st.classB!);
  // طالب من الصف الآخر لا يدخل جزء إربد
  const r = await s3.goto(`/grand/${secA}`); expect(r?.status()).toBe(404);
  await s1.goto(`/grand/${secA}`); await s2.goto(`/grand/${secA}`);
  await expect(s1.getByTestId('online')).toContainText(/.+/, { timeout: 15_000 });
  await expect(s2.getByTestId('online').locator('li')).toHaveCount(2, { timeout: 20_000 });
  // s1 يسحب قطعة ببطء: s2 يرى شبحها باسم زميله
  const t0 = s1.locator('[data-pos="0"]'), b0 = (await t0.boundingBox())!, t4 = (await s1.locator('[data-pos="4"]').boundingBox())!;
  await s1.mouse.move(b0.x + 10, b0.y + 10); await s1.mouse.down();
  for (let i = 1; i <= 16; i++) { await s1.mouse.move(b0.x + 10 + ((t4.x - b0.x) * i) / 16, b0.y + 10 + ((t4.y - b0.y) * i) / 16); await s1.waitForTimeout(60); }
  await expect(s2.getByTestId('peer')).toBeVisible({ timeout: 10_000 });
  await s1.mouse.up();
  // الحل بالتناوب بين الطالبين، وكل حركة تصل إلى الآخر
  const solve = async (pages: Page[]) => {
    for (let k = 0; k < 40; k++) {
      const p = pages[k % pages.length];
      const pieces = await p.locator('[data-pos]').evaluateAll((els) => els.map((e) => +(e as HTMLElement).dataset.piece!));
      const i = pieces.findIndex((v, j) => v !== j); if (i < 0) return;
      const j = pieces.indexOf(i);
      await p.locator(`[data-pos="${i}"]`).click(); await p.locator(`[data-pos="${j}"]`).click();
      await expect(p.locator(`[data-pos="${i}"]`)).toHaveAttribute('data-piece', String(i));
      // الطالب الآخر يرى القطعة نفسها في مكانها
      await expect(pages[(k + 1) % pages.length].locator(`[data-pos="${i}"]`)).toHaveAttribute('data-piece', String(i), { timeout: 10_000 });
    }
  };
  await solve([s1, s2]);
  await expect(s1.getByTestId('grand-section-done')).toBeVisible({ timeout: 10_000 });
  await s3.goto(`/grand/${secB}`); await s4.goto(`/grand/${secB}`);
  await solve([s3, s4]);
  // اللوحة الكاملة للعامة: احتفال واسم كل مدرسة على جزئها
  await A.goto('/grand?m=e2e-demo');
  await expect(A.getByTestId('grand-board')).toHaveAttribute('data-complete', 'true', { timeout: 15_000 });
  await expect(A.getByTestId('grand-board')).toContainText('مدرسة اختبار إربد');
  await expect(A.getByTestId('grand-board')).toContainText('مدرسة في العقبة');
  await a11y(A);
});
