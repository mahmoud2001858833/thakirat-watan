'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { play, buzz } from '@/lib/client/sound';
import type { Ev } from './Almanac';
import s from './quiz.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab', { useGrouping: false }).format(n);
const year = (e: Ev) => +e.date_exact.slice(0, 4);

// عدّاد النقاط للجلسة (يبقى أثناء تقليب الصفحات)
let score = { right: 0, total: 0 };
const subs = new Set<() => void>();
const getScore = () => score;
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const bump = (ok: boolean) => { score = { right: score.right + (ok ? 1 : 0), total: score.total + 1 }; subs.forEach((f) => f()); };

/** «اختبر نفسك»: سؤال من أحداث اليوم المعروض. الخيارات الخاطئة سنوات حقيقية لأحداث أخرى في الأرشيف، لا أرقام مخترعة. */
export function Quiz({ events, pool, dayLabel }: { events: Ev[]; pool: Ev[]; dayLabel: string }) {
  const sc = useSyncExternalStore(sub, getScore, getScore);
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const fromDay = qi < events.length;
  const q = fromDay ? events[qi] : pool.length ? pool[(qi * 7919 + 13) % pool.length] : null;
  const options = useMemo(() => {
    if (!q) return [];
    const y = year(q);
    const others = [...new Set(pool.map(year).filter((x) => x !== y))];
    // أقرب السنوات إلى الصحيحة حتى يكون السؤال جاداً، مع شيء من التنويع
    others.sort((a, b) => Math.abs(a - y) - Math.abs(b - y));
    const near = others.slice(0, 8);
    const g = { seed: q.id.charCodeAt(0) + q.id.charCodeAt(5) + qi };
    const rnd = () => { g.seed = (g.seed * 9301 + 49297) % 233280; return g.seed / 233280; };
    const pick: number[] = [];
    while (pick.length < Math.min(3, near.length)) { const c = near[Math.floor(rnd() * near.length)]; if (!pick.includes(c)) pick.push(c); }
    return [...pick, y].sort((a, b) => a - b);
  }, [q, pool, qi]);
  if (!q) return null;
  const right = year(q);
  const answer = (y: number) => {
    if (chosen !== null) return;
    setChosen(y);
    const ok = y === right;
    bump(ok);
    if (ok) { play('chime'); buzz([12, 40, 12]); } else { play('error'); buzz(30); }
  };
  const next = () => { setChosen(null); setQi((i) => i + 1); play('tap'); };
  return (
    <section className={s.quiz} aria-labelledby="quiz-h">
      <div className={s.head}>
        <h2 id="quiz-h" className={s.title}>اختبر نفسك</h2>
        <p className={s.score} aria-live="polite" data-testid="quiz-score">{sc.total ? `${ar(sc.right)} من ${ar(sc.total)}` : 'أجب لتبدأ العدّ'}</p>
      </div>
      <p className={s.kicker}>{fromDay ? `من أحداث ${dayLabel}` : 'من أيام أخرى في الأرشيف'}</p>
      <p className={s.q}>في أي سنة: <strong>{q.title_ar}</strong>؟</p>
      <div className={s.opts} role="group" aria-label="الخيارات">
        {options.map((y) => {
          const state = chosen === null ? '' : y === right ? s.right : y === chosen ? s.wrong : s.dim;
          return (
            <button key={y} type="button" className={`${s.opt} ${state}`} onClick={() => answer(y)} aria-disabled={chosen !== null}
              data-testid="quiz-opt" data-correct={y === right}>
              {ar(y)}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className={s.result} role="status">
          <p className={s.verdict}>{chosen === right ? 'أحسنت! ' : `ليس تماماً. الجواب ${ar(right)}. `}{q.summary_ar}</p>
          <button type="button" className="btn" onClick={next} data-testid="quiz-next">سؤال آخر</button>
        </div>
      )}
    </section>
  );
}
