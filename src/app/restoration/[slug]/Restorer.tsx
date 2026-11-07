'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import type { Mosaic, Step } from '@/lib/mosaics';
import s from '../lab.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
// خلط حتمي حتى يتطابق أول رسم في الخادم والمتصفح
function seeded(n: number, seed: number) {
  let x = seed; const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

export function Restorer({ mosaic, width, height, steps }: { mosaic: Mosaic; width: number; height: number; steps: Step[] }) {
  const N = mosaic.grid, total = N * N;
  const [order, setOrder] = useState(() => seeded(total, mosaic.slug.length * 7919 + N));
  const [sel, setSel] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [done, setDone] = useState<{ seconds: number } | null>(null);
  const [msg, setMsg] = useState('');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<number | null>(null);
  const correct = order.filter((v, i) => v === i).length;
  const unlocked = done ? steps.length : Math.min(steps.length, Math.floor((correct / total) * steps.length));

  useEffect(() => { refs.current[focus]?.focus({ preventScroll: true }); }, [focus]);

  function swap(a: number, b: number) {
    if (a === b || done) return;
    // eslint-disable-next-line react-hooks/purity -- تُستدعى من معالجات الأحداث فقط، لا أثناء الرسم
    const now = Date.now();
    const st = start ?? now;
    if (start === null) setStart(now);
    const next = [...order]; [next[a], next[b]] = [next[b], next[a]];
    setOrder(next); setMoves((m) => m + 1); setSel(null);
    const ok = next.filter((v, i) => v === i).length;
    setMsg(`بدّلت القطعتين. ${ar(ok)} من ${ar(total)} في مكانها.`);
    if (ok === total) {
      const seconds = Math.round((now - st) / 1000);
      setDone({ seconds });
      setMsg(`اكتملت اللوحة في ${ar(moves + 1)} حركة.`);
      browserClient().rpc('record_mosaic_completion', { p_slug: mosaic.slug, p_moves: moves + 1, p_seconds: seconds }).then(() => {});
    }
  }
  function choose(i: number) {
    if (sel === null) { setSel(i); setMsg('اختر القطعة التي تريد أن تبدّلها معها.'); }
    else swap(sel, i);
  }
  function onKey(e: React.KeyboardEvent, i: number) {
    const r = Math.floor(i / N), c = i % N;
    const map: Record<string, number> = {
      ArrowRight: c > 0 ? i - 1 : i, ArrowLeft: c < N - 1 ? i + 1 : i, // الشبكة من اليمين إلى اليسار
      ArrowUp: r > 0 ? i - N : i, ArrowDown: r < N - 1 ? i + N : i, Home: 0, End: total - 1,
    };
    if (e.key in map) { e.preventDefault(); setFocus(map[e.key]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); }
    else if (e.key === 'Escape') setSel(null);
  }
  function reshuffle() {
    const a = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5);
    if (a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
    setOrder(a); setMoves(0); setStart(null); setDone(null); setSel(null); setMsg('خُلطت القطع من جديد.');
  }

  return (
    <div className={s.lab}>
      <section className={s.boardWrap} aria-labelledby="mosaic-title">
        <div className={s.boardHead}>
          <h1 id="mosaic-title" className={s.boardTitle}>{mosaic.title_ar}</h1>
          <p className={s.stats}><span data-testid="correct">{ar(correct)}</span> / {ar(total)} في مكانها · {ar(moves)} حركة</p>
        </div>
        <div className={`${s.board} ${done ? s.solved : ''}`} style={{ aspectRatio: `${width} / ${height}`, gridTemplateColumns: `repeat(${N}, 1fr)` }}
          role="group" aria-label={`لوحة من ${ar(total)} قطعة. الأسهم للتنقل، والإدخال لاختيار قطعة ثم أخرى لتبديلهما.`}
          onPointerUp={(e) => {
            if (drag.current === null) return;
            const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-pos]') as HTMLElement | null;
            const to = el ? +el.dataset.pos! : null; const from = drag.current; drag.current = null;
            if (to !== null && to !== from) swap(from, to);
          }}>
          {order.map((piece, pos) => {
            const pr = Math.floor(piece / N), pc = piece % N;
            return (
              <button key={piece} type="button" data-pos={pos} data-piece={piece} ref={(el) => { refs.current[pos] = el; }}
                className={`${s.tile} ${piece === pos ? s.home : ''} ${sel === pos ? s.selected : ''}`}
                tabIndex={pos === focus ? 0 : -1} aria-pressed={sel === pos}
                aria-label={`قطعة ${ar(piece + 1)}${piece === pos ? '، في مكانها' : ''}، الموضع ${ar(pos + 1)}`}
                style={{ backgroundImage: `url(${mosaic.image_path})`, backgroundSize: `${N * 100}% ${N * 100}%`, backgroundPosition: `${(pc / (N - 1)) * 100}% ${(pr / (N - 1)) * 100}%` }}
                onClick={() => { setFocus(pos); choose(pos); }}
                onKeyDown={(e) => onKey(e, pos)}
                onPointerDown={(e) => { if (e.pointerType !== 'mouse' || e.button === 0) drag.current = pos; }} />
            );
          })}
        </div>
        <p className={s.live} role="status" aria-live="polite">{msg}</p>
        <div className={s.controls}>
          <button type="button" className="btn" onClick={reshuffle}>اخلط من جديد</button>
          <Link href="/restoration" className="btn btn-quiet">لوحة أخرى</Link>
        </div>
        <p className={s.credit}>
          الصورة: <bdi>{mosaic.credit}</bdi> · {mosaic.license_url ? <a href={mosaic.license_url} target="_blank" rel="noopener noreferrer"><bdi>{mosaic.license}</bdi></a> : mosaic.license} · <a href={mosaic.source_url} target="_blank" rel="noopener noreferrer">المصدر</a>
          {mosaic.item_id && <> · <Link href={`/archive/${mosaic.item_id}`}>المادة في الأرشيف</Link></>}
        </p>
      </section>

      <aside className={s.notebook} aria-labelledby="nb-h">
        <h2 id="nb-h">دفتر المرمم</h2>
        {done && <p className={`notice notice-ok ${s.doneNote}`} data-testid="solved">أعدت اللوحة كاملة في {ar(moves)} حركة و{ar(done.seconds)} ثانية.</p>}
        <p className={s.summary}>{mosaic.summary_ar}</p>
        <ol className={s.steps}>
          {steps.map((st, i) => (
            <li key={st.title} className={i < unlocked ? s.stepOpen : s.stepLocked}>
              <span className={s.stepNum} aria-hidden="true">{ar(i + 1)}</span>
              <div>
                <h3>{st.title}</h3>
                {i < unlocked ? (
                  <>
                    <p>{st.body}</p>
                    <a href={st.source.url} target="_blank" rel="noopener noreferrer" className={s.stepSrc}>المصدر: <bdi>{st.source.citation.split(' — ')[0]}</bdi></a>
                  </>
                ) : <p className={s.lockedText}><span aria-hidden="true">🔒 </span>تنفتح حين تعيد {ar(Math.ceil(((i + 1) / steps.length) * total))} قطعة إلى مكانها.</p>}
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
