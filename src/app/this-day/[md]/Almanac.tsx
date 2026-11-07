'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import { play, buzz } from '@/lib/client/sound';
import { DateDial } from './DateDial';
import { Quiz } from './Quiz';
import s from './paper.module.css';

export type Ev = { id: string; title_ar: string; summary_ar: string | null; date_exact: string; trust: 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review'; is_demo: boolean;
  item_sources: { locator: string | null; sources: { citation: string; url: string | null } }[] };

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const yearAr = (iso: string) => new Intl.NumberFormat('ar-JO-u-nu-arab', { useGrouping: false }).format(+iso.slice(0, 4));
const mdOf = (iso: string) => iso.slice(5, 10);
const parse = (md: string) => ({ mo: +md.slice(0, 2), d: +md.slice(3, 5) });
const shift = (md: string, by: number) => { const { mo, d } = parse(md); const x = new Date(Date.UTC(2024, mo - 1, d + by)); return `${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`; };

type Turn = { dir: 'next' | 'prev'; to: string; a: number; dragging: boolean };

/** الجريدة: صفحة لكل يوم فيه أحداث، تُقلَّب بالسحب أو بالأزرار كما يُقلَّب الورق */
export function Almanac({ events, initial, months, today }: { events: Ev[]; initial: string; months: string[]; today: string }) {
  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events) { const k = mdOf(e.date_exact); m.set(k, [...(m.get(k) ?? []), e]); }
    return m;
  }, [events]);
  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const [md, setMd] = useState(initial);
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnRef = useRef<Turn | null>(null);
  const raf = useRef(0);
  const start = useRef<{ x: number; y: number; w: number; decided: boolean } | null>(null);
  const reduce = useRef(false);
  useEffect(() => { reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);

  const nextDay = useCallback((k: string) => days.find((x) => x > k) ?? days[0], [days]);
  const prevDay = useCallback((k: string) => [...days].reverse().find((x) => x < k) ?? days.at(-1)!, [days]);

  const label = (k: string) => { const { mo, d } = parse(k); return `${ar(d)} ${months[mo - 1]}`; };

  // الرابط يتبع الصفحة المفتوحة دون إعادة تحميل
  useEffect(() => {
    const url = `/this-day/${md}`;
    if (location.pathname !== url) history.replaceState(history.state, '', url);
    document.title = `هذا اليوم في الأردن — ${label(md)} — ذاكرة وطن`;
  }, [md]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (t: Turn | null) => { turnRef.current = t; setTurn(t); };
  const finish = useCallback((t: Turn, complete: boolean) => {
    cancelAnimationFrame(raf.current);
    const target = complete ? (t.dir === 'next' ? 180 : 0) : (t.dir === 'next' ? 0 : 180);
    const from = t.a, t0 = performance.now(), dur = reduce.current ? 1 : 520 * Math.abs(target - from) / 180 + 120;
    if (complete) play('page');
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const a = from + (target - from) * e;
      if (k < 1) { set({ ...t, a, dragging: false }); raf.current = requestAnimationFrame(step); }
      else { if (complete) { setMd(t.to); buzz(8); } set(null); }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const flipTo = useCallback((to: string, dir?: 'next' | 'prev') => {
    if (turnRef.current || to === md) return;
    const d = dir ?? (to > md ? 'next' : 'prev');
    const t: Turn = { dir: d, to, a: d === 'next' ? 0 : 180, dragging: false };
    set(t); finish(t, true);
  }, [md, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea, [role="slider"]')) return;
      if (e.key === 'ArrowLeft') flipTo(nextDay(md), 'next');
      if (e.key === 'ArrowRight') flipTo(prevDay(md), 'prev');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [md, flipTo, nextDay, prevDay]);

  // السحب: من اليسار إلى اليمين يقلب إلى الصفحة التالية (كالكتاب العربي)، والعكس للسابقة
  const onDown = (e: React.PointerEvent) => {
    if (turnRef.current || (e.target as HTMLElement).closest('a, button, select, input, [role="slider"]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, w: (e.currentTarget as HTMLElement).clientWidth, decided: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const st = start.current; if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.decided) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { start.current = null; return; } // تمرير عمودي
      st.decided = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const dir = dx > 0 ? 'next' : 'prev';
      set({ dir, to: dir === 'next' ? nextDay(md) : prevDay(md), a: dir === 'next' ? 0 : 180, dragging: true });
      play('page');
    }
    const t = turnRef.current; if (!t) return;
    const p = Math.min(1, Math.max(0, (t.dir === 'next' ? dx : -dx) / (st.w * 0.9)));
    set({ ...t, a: t.dir === 'next' ? p * 180 : 180 - p * 180, dragging: true });
  };
  const onUp = () => {
    const st = start.current; start.current = null;
    const t = turnRef.current; if (!st || !t || !t.dragging) return;
    const p = t.dir === 'next' ? t.a / 180 : 1 - t.a / 180;
    finish(t, p > 0.3);
  };

  // الطبقات: الصفحة التي ستظهر تحت، والورقة المتحركة فوقها
  const under = turn ? (turn.dir === 'next' ? turn.to : md) : null;
  const leaf = turn ? (turn.dir === 'next' ? md : turn.to) : md;
  const a = turn?.a ?? 0;
  const shade = Math.sin((a * Math.PI) / 180);
  const evs = byDay.get(md) ?? [];

  return (
    <div className={s.almanac}>
      <div className={s.controlsTop}>
        <button type="button" className={`btn ${s.turnBtn}`} onClick={() => flipTo(prevDay(md), 'prev')} aria-label={`الصفحة السابقة: ${label(prevDay(md))}`}>→ السابقة</button>
        <DateDial months={months} value={md} marked={days} today={today} onPick={(k) => flipTo(k)} />
        <button type="button" className={`btn ${s.turnBtn}`} onClick={() => flipTo(nextDay(md), 'next')} aria-label={`الصفحة التالية: ${label(nextDay(md))}`} data-testid="next-page">التالية ←</button>
      </div>

      <div className={s.book} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="book">
        {under && <div className={s.sheet} aria-hidden="true"><Page k={under} evs={byDay.get(under) ?? []} label={label} near={[prevDay(under), nextDay(under)]} />
          <div className={s.underShade} style={{ opacity: shade * 0.5 }} /></div>}
        <div className={`${s.sheet} ${s.leaf}`} style={{ transform: `perspective(5200px) rotateY(${a}deg)`, zIndex: 2 }} data-angle={Math.round(a)}>
          <div className={s.front} aria-live="polite">
            <Page k={leaf} evs={byDay.get(leaf) ?? []} label={label} near={[prevDay(leaf), nextDay(leaf)]} />
            <div className={s.curl} style={{ opacity: shade, backgroundPosition: `${100 - (a / 180) * 100}% 0` }} />
          </div>
          <div className={s.back} aria-hidden="true" />
        </div>
      </div>
      <p className={s.flipHint}>اسحب الصفحة من اليسار إلى اليمين لتقلّبها، أو استخدم الأسهم.</p>

      <Quiz key={md} events={evs.length ? evs : (byDay.get(nextDay(md)) ?? [])} pool={events} dayLabel={label(evs.length ? md : nextDay(md))} />
    </div>
  );
}

function Page({ k, evs, label, near }: { k: string; evs: Ev[]; label: (k: string) => string; near: [string, string] }) {
  const lead = evs.at(-1), rest = evs.slice(0, -1);
  const { d } = parse(k);
  return (
    <div className={s.paper}>
      <header className={s.masthead}>
        <p className={s.edition}>ذاكرة وطن · صفحة من الأرشيف</p>
        <p className={s.name} role="heading" aria-level={1}>هذا اليوم في الأردن</p>
        <div className={s.dateline}>
          <span className={s.issue}>العدد {ar(dayOfYear(k))}</span>
          <p className={s.date}><span>{ar(d)}</span> {label(k).split(' ').slice(1).join(' ')}</p>
          <span className={s.issue}>{evs.length ? `${ar(evs.length)} ${evs.length === 1 ? 'حدث' : 'أحداث'}` : 'لا أحداث'}</span>
        </div>
      </header>
      {!lead ? (
        <section className={s.empty}>
          <p className={s.emptyTitle}>لا توجد أحداث موثقة لهذا اليوم بعد.</p>
          <p>ننشر هنا الأحداث ذات المصادر فقط. أقرب الأيام: {label(near[0])}، و{label(near[1])}.</p>
        </section>
      ) : (
        <>
          <article className={s.lead}>
            <p className={s.year}>{yearAr(lead.date_exact)}</p>
            <h2 className={s.headline}>{lead.title_ar}</h2>
            <p className={s.body}>{lead.summary_ar}</p>
            <Footnote e={lead} />
          </article>
          {rest.length > 0 && (
            <div className={s.columns}>
              {rest.map((e) => (
                <article key={e.id} className={s.story}>
                  <p className={s.year}>{yearAr(e.date_exact)}</p>
                  <h3 className={s.subhead}>{e.title_ar}</h3>
                  <p className={s.body}>{e.summary_ar}</p>
                  <Footnote e={e} />
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const dayOfYear = (k: string) => { const { mo, d } = parse(k); return Math.round((Date.UTC(2024, mo - 1, d) - Date.UTC(2024, 0, 1)) / 864e5) + 1; };

function Footnote({ e }: { e: Ev }) {
  return (
    <div className={s.foot}>
      <span className={s.badges}><TrustBadge trust={e.trust} />{e.is_demo && <DemoTag />}</span>
      <span className={s.src}>
        المصدر: {e.item_sources.map(({ sources: src }, i) => (
          <span key={i}>{i > 0 && '، '}{src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer"><bdi>{src.citation}</bdi></a> : <bdi>{src.citation}</bdi>}</span>
        ))}
      </span>
    </div>
  );
}

export { shift };
export const DayLink = ({ k, children }: { k: string; children: React.ReactNode }) => <Link href={`/this-day/${k}`}>{children}</Link>;
