'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { play, buzz } from '@/lib/client/sound';
import type { Mosaic, Step } from '@/lib/mosaics';
import { Leaderboard, type Best } from './Leaderboard';
import s from '../lab.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const clock = (sec: number) => `${ar(Math.floor(sec / 60))}:${new Intl.NumberFormat('ar-JO-u-nu-arab', { minimumIntegerDigits: 2 }).format(sec % 60)}`;
// خلط حتمي حتى يتطابق أول رسم في الخادم والمتصفح
function seeded(n: number, seed: number) {
  let x = seed; const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

type Drag = { pos: number; piece: number; id: number; x0: number; y0: number; dx: number; dy: number; w: number; h: number; left: number; top: number; active: boolean };

export function Restorer({ mosaic, width, height, steps, best }: { mosaic: Mosaic; width: number; height: number; steps: Step[]; best: Best[] }) {
  const N = mosaic.grid, total = N * N;
  const [order, setOrder] = useState(() => seeded(total, mosaic.slug.length * 7919 + N));
  const [sel, setSel] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState<{ seconds: number; rank: number | null } | null>(null);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [board, setBoard] = useState(best);
  const [mine, setMine] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rects = useRef(new Map<number, DOMRect>());
  const dragRef = useRef<Drag | null>(null);
  const correct = order.filter((v, i) => v === i).length;
  const unlocked = done ? steps.length : Math.min(steps.length, Math.floor((correct / total) * steps.length));
  const elapsed = start ? Math.floor(((done ? start + done.seconds * 1000 : now) - start) / 1000) : 0;

  useEffect(() => { refs.current[focus]?.focus({ preventScroll: true }); }, [focus]);
  useEffect(() => { try { const b = localStorage.getItem(`best:${mosaic.slug}`); if (b) setMine(+b); } catch {} }, [mosaic.slug]); // eslint-disable-line react-hooks/set-state-in-effect
  // العدّاد
  useEffect(() => {
    if (!start || done) return;
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [start, done]);

  // FLIP: القطع تنزلق من مكانها القديم إلى الجديد
  useLayoutEffect(() => {
    if (!rects.current.size) return;
    refs.current.forEach((el) => {
      if (!el) return;
      const piece = +el.dataset.piece!; const old = rects.current.get(piece); if (!old) return;
      const nw = el.getBoundingClientRect(); const dx = old.left - nw.left, dy = old.top - nw.top;
      if (!dx && !dy) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' });
    });
    rects.current.clear();
  }, [order]);

  function swap(a: number, b: number, fromDrag = false) {
    if (a === b || done) return;
    // eslint-disable-next-line react-hooks/purity -- تُستدعى من معالجات الأحداث فقط
    const t = Date.now();
    const st = start ?? t;
    if (start === null) setStart(t);
    // نحفظ المواضع قبل التبديل للانزلاق (القطعة المسحوبة تبقى حيث أُفلتت)
    refs.current.forEach((el) => { if (el && !(fromDrag && +el.dataset.pos! === a)) rects.current.set(+el.dataset.piece!, el.getBoundingClientRect()); });
    const next = [...order]; [next[a], next[b]] = [next[b], next[a]];
    setOrder(next); setMoves((m) => m + 1); setSel(null);
    const ok = next.filter((v, i) => v === i).length;
    const landed = next[b] === b ? b : next[a] === a ? a : null;
    if (landed !== null) { play('snap'); buzz(18); setFlash(landed); setTimeout(() => setFlash(null), 700); }
    else play('tap');
    setMsg(`${landed !== null ? 'أحسنت، قطعة في مكانها. ' : ''}${ar(ok)} من ${ar(total)} في مكانها.`);
    if (ok === total) {
      const seconds = Math.max(1, Math.round((t - st) / 1000));
      setDone({ seconds, rank: null });
      setMsg(`اكتملت اللوحة في ${ar(moves + 1)} حركة و${clock(seconds)}.`);
      play('chime'); buzz([20, 60, 20, 60, 40]);
      try { if (!mine || seconds < mine) { localStorage.setItem(`best:${mosaic.slug}`, String(seconds)); setMine(seconds); } } catch {}
      const sb = browserClient();
      sb.rpc('finish_mosaic', { p_slug: mosaic.slug, p_moves: moves + 1, p_seconds: seconds }).then(async ({ data }: { data: unknown }) => {
        const rank = typeof data === 'number' ? data : null;
        setDone({ seconds, rank });
        const { data: lb }: { data: unknown } = await sb.rpc('mosaic_leaderboard', { p_slug: mosaic.slug });
        if (lb) setBoard(lb as Best[]);
      });
    }
  }
  function choose(i: number) {
    if (sel === null) { setSel(i); play('tap'); setMsg('اختر القطعة التي تريد أن تبدّلها معها.'); }
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
    refs.current.forEach((el) => { if (el) rects.current.set(+el.dataset.piece!, el.getBoundingClientRect()); });
    setOrder(a); setMoves(0); setStart(null); setDone(null); setSel(null); setMsg('خُلطت القطع من جديد.'); play('rustle');
  }

  // السحب الحقيقي: القطعة تتبع الإصبع أو الفأرة، وتُفلت فوق قطعة أخرى لتتبادلا
  const targetAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).dataset?.pos !== undefined && !(n as HTMLElement).dataset.ghost) as HTMLElement | undefined;
    return el ? +el.dataset.pos! : null;
  };
  const onDown = (e: React.PointerEvent, pos: number) => {
    if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement; const r = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    const d: Drag = { pos, piece: order[pos], id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, w: r.width, h: r.height, left: r.left, top: r.top, active: false };
    dragRef.current = d;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.active && Math.hypot(dx, dy) < 6) return;
    if (!d.active) { d.active = true; setSel(null); play('pop'); buzz(6); }
    d.dx = dx; d.dy = dy;
    setDrag({ ...d });
    const t = targetAt(e.clientX, e.clientY);
    setOver(t !== null && t !== d.pos ? t : null);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current; dragRef.current = null; if (!d || d.id !== e.pointerId) return;
    setDrag(null); setOver(null);
    if (!d.active) return; // نقرة عادية: يعالجها onClick
    const t = targetAt(e.clientX, e.clientY);
    if (t !== null && t !== d.pos) swap(d.pos, t, true);
    else play('tap');
    // نمنع النقرة التي تلي السحب
    suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0);
  };
  const suppressClick = useRef(false);
  const bg = (piece: number) => {
    const pr = Math.floor(piece / N), pc = piece % N;
    return { backgroundImage: `url(${mosaic.image_path})`, backgroundSize: `${N * 100}% ${N * 100}%`, backgroundPosition: `${(pc / (N - 1)) * 100}% ${(pr / (N - 1)) * 100}%` };
  };

  return (
    <div className={s.lab}>
      <section className={s.boardWrap} aria-labelledby="mosaic-title">
        <div className={s.boardHead}>
          <h1 id="mosaic-title" className={s.boardTitle}>{mosaic.title_ar}</h1>
          <p className={s.stats}>
            <span className={s.timer} data-testid="timer" aria-label={`الوقت ${clock(elapsed)}`}><span aria-hidden="true">⏱</span> {clock(elapsed)}</span>
            <span><span data-testid="correct">{ar(correct)}</span> / {ar(total)} في مكانها</span>
            <span>{ar(moves)} حركة</span>
          </p>
        </div>
        <div className={s.progress} aria-hidden="true"><span style={{ width: `${(correct / total) * 100}%` }} /></div>
        <div className={`${s.board} ${done ? s.solved : ''}`} style={{ aspectRatio: `${width} / ${height}`, gridTemplateColumns: `repeat(${N}, 1fr)` }}
          role="group" aria-label={`لوحة من ${ar(total)} قطعة. اسحب قطعة فوق أخرى لتتبادلا، أو استخدم الأسهم والإدخال.`}>
          {order.map((piece, pos) => (
            <button key={piece} type="button" data-pos={pos} data-piece={piece} ref={(el) => { refs.current[pos] = el; }}
              className={`${s.tile} ${piece === pos ? s.home : ''} ${sel === pos ? s.selected : ''} ${drag?.active && drag.pos === pos ? s.lifted : ''} ${over === pos ? s.over : ''} ${flash === pos ? s.flash : ''}`}
              tabIndex={pos === focus ? 0 : -1} aria-pressed={sel === pos}
              aria-label={`قطعة ${ar(piece + 1)}${piece === pos ? '، في مكانها' : ''}، الموضع ${ar(pos + 1)}`}
              style={bg(piece)}
              onClick={() => { if (suppressClick.current) return; setFocus(pos); choose(pos); }}
              onKeyDown={(e) => onKey(e, pos)}
              onPointerDown={(e) => onDown(e, pos)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          ))}
        </div>
        {drag?.active && (
          <div className={s.ghost} data-ghost="1" aria-hidden="true"
            style={{ ...bg(drag.piece), width: drag.w, height: drag.h, transform: `translate(${drag.left + drag.dx}px, ${drag.top + drag.dy}px) rotate(${Math.max(-6, Math.min(6, drag.dx / 30))}deg) scale(1.08)` }} />
        )}
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
        {done && <p className={`notice notice-ok ${s.doneNote}`} data-testid="solved">أعدت اللوحة كاملة في {ar(moves)} حركة و{clock(done.seconds)}.{done.rank ? ` ترتيبك ${ar(done.rank)} بين كل من رمّمها.` : ''}</p>}
        <Leaderboard rows={board} mine={mine} justDone={done?.seconds ?? null} />
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
