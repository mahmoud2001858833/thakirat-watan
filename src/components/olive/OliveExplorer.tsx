'use client';
import { useActionState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { play } from '@/lib/client/sound';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { plantLeaf, type LeafState } from '@/app/olive/actions';
import { GOV_TONES, type TreeState } from './tree';
import { OliveCanvas } from './OliveCanvas';
import s from './olive.module.css';

type Gov = { id: string; key: string; name_ar: string };
type Leaf = { id: string; body: string; display_name: string | null; governorate_id: string; created_at: string; is_demo: boolean; status: string };
const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const SEASON: Record<string, string> = { spring: 'ربيع: الشجرة تزهر', summer: 'صيف: ظل ممتد', autumn: 'خريف: موسم القطاف', winter: 'شتاء: سكون' };

export function OliveExplorer({ state, govs, schools, signedIn, buds, planted }: {
  state: TreeState; govs: Gov[]; schools: { id: string; name: string }[]; signedIn: boolean;
  buds: { id: string; governorate_id: string }[]; planted: string | null;
}) {
  const [gov, setGov] = useState<number | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [open, setOpen] = useState<Leaf | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<{ ids: string[]; g: number[]; s: (string | null)[] } | null>(null);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Leaf[]>([]);
  const [form, formAction, pending] = useActionState(plantLeaf, { status: 'idle' } as LeafState);
  const gIndex = useMemo(() => new Map(govs.map((g, i) => [g.id, i])), [govs]);
  const budList = useMemo(() => buds.map((b) => ({ id: b.id, g: gIndex.get(b.governorate_id) ?? 0 })), [buds, gIndex]);

  const pick = useCallback(async (id: string, at?: { x: number; y: number }) => {
    origin.current = at ?? null;
    const { data }: { data: Leaf | null } = await browserClient().from('olive_leaves').select('id, body, display_name, governorate_id, created_at, is_demo, status').eq('id', id).maybeSingle();
    if (data) setOpen(data as Leaf);
  }, []);
  // الذكرى تتفتح من موضع الورقة نفسها
  useLayoutEffect(() => {
    const el = sheet.current; if (!el || !open) return;
    const r = el.getBoundingClientRect(), o = origin.current ?? { x: r.left + r.width / 2, y: r.top };
    el.style.setProperty('--ox', `${o.x - r.left}px`); el.style.setProperty('--oy', `${o.y - r.top}px`);
    el.dataset.anim = 'false'; void el.offsetWidth; el.dataset.anim = 'true';
  }, [open]);
  const close = () => { setOpen(null); play('tap'); };
  const onData = useCallback((d: { ids: string[]; g: number[]; s: (string | null)[] }) => setList(d), []);

  // البديل النصي: 24 ورقة في كل صفحة حسب الفلتر
  const filtered = useMemo(() => list ? list.ids.filter((_, i) => (gov === null || list.g[i] === gov) && (!school || list.s[i] === school)).reverse() : [], [list, gov, school]);
  const pageIds = useMemo(() => filtered.slice(page * 24, page * 24 + 24), [filtered, page]);
  useEffect(() => {
    if (!pageIds.length) return;
    let live = true;
    browserClient().from('olive_leaves').select('id, body, display_name, governorate_id, created_at, is_demo, status').in('id', pageIds)
      .then(({ data }: { data: Leaf[] | null }) => { if (live) setItems(data ?? []); });
    return () => { live = false; };
  }, [pageIds]);
  // ما يُعرض هو أوراق الصفحة الحالية فقط بترتيبها
  const shown = pageIds.map((id) => items.find((x) => x.id === id)).filter((x): x is Leaf => !!x);

  const govName = (id: string) => govs.find((g) => g.id === id)?.name_ar ?? '';
  const count = gov === null && !school ? state.total : filtered.length;

  return (
    <div className={s.explorer}>
      <div className={s.bar}>
        <div className={s.counter} aria-live="polite">
          <span className={s.count} data-testid="leaf-count">{ar(count)}</span>
          <span className={s.countLabel}>{gov === null && !school ? 'ورقة على الشجرة' : 'ورقة في هذا الاختيار'}</span>
        </div>
        <p className={s.season}>{SEASON[state.season]}{state.blooming && ' · الشجرة مزهرة'}{state.golden && ' · زيتون ذهبي'}</p>
        <div className={s.filters}>
          <label htmlFor="f-gov" className="sr-only">المحافظة</label>
          <select id="f-gov" value={gov ?? ''} onChange={(e) => { setGov(e.target.value === '' ? null : +e.target.value); setPage(0); }}>
            <option value="">كل المحافظات</option>
            {govs.map((g, i) => <option key={g.id} value={i}>{g.name_ar}</option>)}
          </select>
          {schools.length > 0 && (
            <>
              <label htmlFor="f-sch" className="sr-only">المدرسة</label>
              <select id="f-sch" value={school ?? ''} onChange={(e) => { setSchool(e.target.value || null); setPage(0); }}>
                <option value="">كل المدارس</option>
                {schools.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      <OliveCanvas state={state} govs={govs} buds={budList} filterGov={gov} filterSchool={school} onPick={pick} onData={onData} planted={planted} />

      <ul className={s.legend} aria-label="ألوان المحافظات">
        {govs.map((g, i) => (
          <li key={g.id}><button type="button" aria-pressed={gov === i} onClick={() => { setGov(gov === i ? null : i); setPage(0); }}>
            <span className={s.swatch} style={{ background: GOV_TONES[i] }} aria-hidden="true" />{g.name_ar}
          </button></li>
        ))}
      </ul>

      {open && (
        <div ref={sheet} key={open.id} className={s.sheet} role="dialog" aria-modal="false" aria-labelledby="leaf-h" data-testid="leaf-sheet"
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          <span className={s.sheetLeaf} aria-hidden="true" />
          <button type="button" className={s.close} onClick={close} aria-label="أغلق">×</button>
          <p id="leaf-h" className={s.sheetGov}>{govName(open.governorate_id)}{open.is_demo && <span className={s.demo}>تجريبي</span>}{open.status === 'pending' && <span className={s.demo}>برعم بانتظار المراجعة</span>}</p>
          <blockquote className={s.quote}>{open.body}</blockquote>
          <p className={s.sheetMeta}>{open.display_name && <>— {open.display_name} · </>}{new Intl.DateTimeFormat('ar-JO-u-nu-arab', { dateStyle: 'long' }).format(new Date(open.created_at))}</p>
          {open.status === 'published' && <Link href={`/olive/leaf/${open.id}`}>رابط هذه الورقة</Link>}
        </div>
      )}

      <div className={s.lower}>
        <section className={s.plant} aria-labelledby="plant-h">
          <h2 id="plant-h">انثر ورقتك</h2>
          {planted && <p role="status" className="notice notice-ok">نبتت ورقتك برعماً على غصن محافظتك. تراها أنت الآن، ويراها الناس بعد مراجعة الأمين.</p>}
          {!signedIn ? (
            <p>لتضيف ورقة، <Link href="/signin?next=/olive">ادخل إلى حسابك</Link>. تبدأ كل ورقة برعماً لا يراه غيرك حتى يراجعها الأمين.</p>
          ) : (
            <form action={formAction}>
              {form.status === 'error' && <p role="alert" className="notice notice-error">{form.message}</p>}
              {form.status === 'rate' && <p role="alert" className="notice notice-error">وصلت إلى حد عشر أوراق في اليوم. عُد غداً.</p>}
              <div className="field">
                <label htmlFor="body">ذكرى أو مثل أو حكاية قصيرة <span className="hint">حتى 280 حرفاً</span></label>
                <textarea id="body" name="body" maxLength={280} minLength={2} required rows={4} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="governorate_id">محافظتك</label>
                  <select id="governorate_id" name="governorate_id" required defaultValue="">
                    <option value="" disabled>اختر</option>
                    {govs.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="display_name">اسمك الأول <span className="hint">اختياري. نعرض الاسم الأول فقط، وللطلاب أسماؤهم المستعارة</span></label>
                  <input id="display_name" name="display_name" type="text" maxLength={40} />
                </div>
              </div>
              <button className="btn btn-primary" disabled={pending}>انثر الورقة</button>
            </form>
          )}
        </section>

        <section className={s.read} aria-labelledby="read-h">
          <h2 id="read-h">اقرأ الأوراق</h2>
          <ul className={s.leafList} data-testid="leaf-list">
            {shown.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); origin.current = { x: r.left + 20, y: r.top + r.height / 2 }; setOpen(l); play('rustle'); }}>
                  <span className={s.leafBody}>{l.body}</span>
                  <span className={s.leafMeta}>{govName(l.governorate_id)}{l.is_demo && ' · تجريبي'}</span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > 24 && (
            <div className={s.pager}>
              <button type="button" className="btn btn-quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>الأحدث</button>
              <span>{ar(page + 1)} / {ar(Math.ceil(filtered.length / 24))}</span>
              <button type="button" className="btn btn-quiet" disabled={(page + 1) * 24 >= filtered.length} onClick={() => setPage(page + 1)}>الأقدم</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
