'use client';
import type { Activity, Results } from '@/lib/live';
import s from './live.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);

/** النتائج كما تظهر على شاشة الصف: أعمدة تصويت متحركة، وإشارات على الصورة، والنصوص المعتمدة فقط */
export function ResultsView({ act, res, reveal, big = false, onPin, mine = [] }: {
  act: Activity; res: Results; reveal: boolean; big?: boolean; onPin?: (x: number, y: number) => void; mine?: [number, number][];
}) {
  const total = res.votes.reduce((a, v) => a + v.n, 0);
  const img = act.image && (
    <div className={`${s.picture} ${onPin ? s.pinnable : ''}`} onClick={onPin ? (e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onPin((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    } : undefined} data-testid="live-picture">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={act.image} alt="صورة الجلسة من الأرشيف" draggable={false} />
      {act.kind === 'pin' && reveal && res.pins.map(([x, y], i) => <span key={i} className={s.pin} style={{ left: `${x * 100}%`, top: `${y * 100}%`, animationDelay: `${(i % 12) * 40}ms` }} aria-hidden="true" />)}
      {mine.map(([x, y], i) => <span key={`m${i}`} className={`${s.pin} ${s.pinMine}`} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden="true" />)}
    </div>
  );
  return (
    <div className={`${s.results} ${big ? s.resultsBig : ''}`}>
      {img}
      {act.kind === 'poll' && (
        <ol className={s.bars} data-testid="bars">
          {act.options.map((o, i) => {
            const n = res.votes.find((v) => v.choice === i)?.n ?? 0, pct = total ? (n / total) * 100 : 0;
            return (
              <li key={i} className={s.barRow}>
                <span className={s.barLabel}>{o}</span>
                <span className={s.barTrack}><span className={s.bar} style={{ width: reveal ? `${pct}%` : '0%' }} /></span>
                <span className={s.barN} data-testid="bar-n">{reveal ? ar(n) : '؟'}</span>
              </li>
            );
          })}
        </ol>
      )}
      {act.kind === 'pin' && <p className={s.hint}>{ar(res.pins.length)} إشارة على الصورة</p>}
      {act.kind === 'text' && reveal && (
        <ul className={s.texts} data-testid="screen-texts">
          {res.texts.map((t) => <li key={t.id} className={s.textCard}><p>{t.body}</p><span>— {t.by}</span></li>)}
          {!res.texts.length && <li className={s.hint}>لم يعرض المعلم إجابات بعد.</li>}
        </ul>
      )}
    </div>
  );
}
