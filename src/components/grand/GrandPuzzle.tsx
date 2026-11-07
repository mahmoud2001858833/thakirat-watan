'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/browser';
import { crop, type GrandMosaic } from '@/lib/grand';
import { play, buzz } from '@/lib/client/sound';
import s from './grand.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
type Peer = { piece: number; x: number; y: number; t: number };
type Drag = { pos: number; piece: number; id: number; x0: number; y0: number; dx: number; dy: number; w: number; h: number; left: number; top: number; active: boolean };

/** ترميم جزء الصف معاً: كل طالب يرى قطع زملائه تتحرك مباشرة (Realtime)، والتبديل يتم في القاعدة بقفل يمنع التضارب */
export function GrandPuzzle({ mosaic, section, me, names }: {
  mosaic: GrandMosaic; section: { id: string; idx: number; state: number[]; moves: number; done: boolean }; me: { id: string; name: string }; names: Record<string, string>;
}) {
  const g = mosaic.piece_grid, n = g * g;
  const [state, setState] = useState(section.state);
  const [done, setDone] = useState(section.done);
  const [moves, setMoves] = useState(section.moves);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [online, setOnline] = useState<string[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rects = useRef(new Map<number, DOMRect>());
  const dragRef = useRef<Drag | null>(null);
  const chan = useRef<RealtimeChannel | null>(null);
  const lastSend = useRef(0);
  const suppress = useRef(false);
  const [bw, setBw] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = board.current; if (!el) return;
    const ro = new ResizeObserver(() => setBw({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const nameOf = (id: string) => (id === me.id ? 'أنت' : names[id] ?? (id.startsWith('t:') ? 'المعلم' : 'زميل'));
  const correct = state.filter((v, i) => v === i).length;

  const snapshot = () => refs.current.forEach((el) => { if (el) rects.current.set(+el.dataset.piece!, el.getBoundingClientRect()); });
  useLayoutEffect(() => {
    if (!rects.current.size) return;
    refs.current.forEach((el) => {
      if (!el) return; const old = rects.current.get(+el.dataset.piece!); if (!old) return;
      const nw = el.getBoundingClientRect(), dx = old.left - nw.left, dy = old.top - nw.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)' });
    });
    rects.current.clear();
  }, [state]);

  // القناة: تغييرات القاعدة للجميع، وبث خاص لحركة القطع وحضور الزملاء
  useEffect(() => {
    const sb = browserClient();
    let stop = false;
    let cleanup = () => {};
    (async () => {
      const { data: sess } = await sb.auth.getSession();
      if (sess.session) await sb.realtime.setAuth(sess.session.access_token);
      if (stop) return;
      const db = sb.channel(`grand-db:${section.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'grand_sections', filter: `id=eq.${section.id}` }, (p: { new: { state: number[]; moves: number; completed_at: string | null } }) => {
          snapshot(); setState(p.new.state); setMoves(p.new.moves);
          if (p.new.completed_at) setDone(true);
        }).subscribe();
      const ch = sb.channel(`grand:${section.id}`, { config: { private: true, broadcast: { self: false }, presence: { key: me.id } } })
        .on('broadcast', { event: 'drag' }, ({ payload }: { payload: { m: string; p: number; x: number; y: number } }) =>
          setPeers((x) => ({ ...x, [payload.m]: { piece: payload.p, x: payload.x, y: payload.y, t: Date.now() } })))
        .on('broadcast', { event: 'drop' }, ({ payload }: { payload: { m: string; ok?: boolean } }) => {
          setPeers((x) => { const c = { ...x }; delete c[payload.m]; return c; });
          if (payload.ok) { setFeed((f) => [`${nameOf(payload.m)} أعاد قطعة إلى مكانها`, ...f].slice(0, 12)); play('snap'); }
        })
        .on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState())))
        .subscribe(async (st: string) => { setLive(st === 'SUBSCRIBED'); if (st === 'SUBSCRIBED') await ch.track({ at: Date.now() }); });
      chan.current = ch;
      cleanup = () => { sb.removeChannel(db); sb.removeChannel(ch); };
    })();
    return () => { stop = true; cleanup(); };
  }, [section.id, me.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // احتياط: حالة الجزء من القاعدة كل بضع ثوانٍ
  useEffect(() => {
    const t = setInterval(async () => {
      if (dragRef.current || document.visibilityState !== 'visible') return;
      const { data } = await browserClient().from('grand_sections').select('state, moves, completed_at').eq('id', section.id).maybeSingle();
      if (!data) return;
      setState((old) => { if (old.join() === (data.state as number[]).join()) return old; snapshot(); return data.state as number[]; });
      setMoves(data.moves); if (data.completed_at) setDone(true);
    }, 5000);
    return () => clearInterval(t);
  }, [section.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // أشباح الزملاء تختفي إن انقطعوا
  useEffect(() => {
    const t = setInterval(() => setPeers((x) => Object.fromEntries(Object.entries(x).filter(([, p]) => Date.now() - p.t < 4000))), 1500);
    return () => clearInterval(t);
  }, []);

  async function swap(a: number, b: number, fromDrag: boolean) {
    if (a === b || done) return;
    refs.current.forEach((el) => { if (el && !(fromDrag && +el.dataset.pos! === a)) rects.current.set(+el.dataset.piece!, el.getBoundingClientRect()); });
    const next = [...state]; [next[a], next[b]] = [next[b], next[a]];
    setState(next);
    const landed = next[b] === b ? b : next[a] === a ? a : null;
    if (landed !== null) { play('snap'); buzz(18); setFlash(landed); setTimeout(() => setFlash(null), 700); } else play('tap');
    chan.current?.send({ type: 'broadcast', event: 'drop', payload: { m: me.id, ok: landed !== null } });
    const { data, error } = await browserClient().rpc('grand_move', { p_section: section.id, p_from: a, p_to: b });
    if (error) { snapshot(); setState(state); play('error'); return; }
    const r = data as { state: number[]; done: boolean };
    if (r.state.join() !== next.join()) { snapshot(); setState(r.state); }
    setMoves((m) => m + 1);
    if (r.done) { setDone(true); play('chime'); buzz([30, 80, 30]); }
  }

  const targetAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((e) => (e as HTMLElement).dataset?.pos !== undefined) as HTMLElement | undefined;
    return el ? +el.dataset.pos! : null;
  };
  const onDown = (e: React.PointerEvent, pos: number) => {
    if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    dragRef.current = { pos, piece: state[pos], id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, w: r.width, h: r.height, left: r.left, top: r.top, active: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.active && Math.hypot(dx, dy) < 6) return;
    if (!d.active) { d.active = true; play('pop'); buzz(6); }
    d.dx = dx; d.dy = dy; setDrag({ ...d });
    const t = targetAt(e.clientX, e.clientY); setOver(t !== null && t !== d.pos ? t : null);
    // eslint-disable-next-line react-hooks/purity -- معالج حدث، لا رسم
    const now = performance.now(), b = board.current?.getBoundingClientRect();
    if (b && now - lastSend.current > 40) {
      lastSend.current = now;
      chan.current?.send({ type: 'broadcast', event: 'drag', payload: { m: me.id, p: d.piece, x: (d.left + dx - b.left) / b.width, y: (d.top + dy - b.top) / b.height } });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current; dragRef.current = null; if (!d || d.id !== e.pointerId) return;
    setDrag(null); setOver(null);
    if (!d.active) return;
    suppress.current = true; setTimeout(() => { suppress.current = false; }, 0);
    const t = targetAt(e.clientX, e.clientY);
    if (t !== null && t !== d.pos) swap(d.pos, t, true);
    else chan.current?.send({ type: 'broadcast', event: 'drop', payload: { m: me.id } });
  };
  const [sel, setSel] = useState<number | null>(null);
  const tap = (pos: number) => { if (suppress.current || done) return; if (sel === null) { setSel(pos); play('tap'); } else { swap(sel, pos, false); setSel(null); } };

  const tileW = bw.w ? (bw.w - 3 * (g + 1)) / g : 0;
  return (
    <div className={s.lab}>
      <section aria-labelledby="sec-h">
        <h1 id="sec-h" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-2)' }}>جزء صفنا من {mosaic.title_ar}</h1>
        <p style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          <span data-testid="grand-correct">{ar(correct)}</span> / {ar(n)} في مكانها · {ar(moves)} حركة من الصف كله
        </p>
        <div ref={board} className={s.puzzle} style={{ gridTemplateColumns: `repeat(${g}, 1fr)`, aspectRatio: `${mosaic.width / mosaic.cols} / ${mosaic.height / mosaic.rows}` }}
          role="group" aria-label="قطع الجزء. اسحب قطعة فوق أخرى لتتبادلا، أو المس قطعتين." data-testid="grand-puzzle">
          {state.map((piece, pos) => {
            const peerOn = Object.values(peers).some((p) => p.piece === piece);
            return (
              <button key={piece} type="button" ref={(el) => { refs.current[pos] = el; }} data-pos={pos} data-piece={piece}
                className={`${s.tile} ${piece === pos ? s.tileHome : ''} ${drag?.active && drag.pos === pos ? s.tileLifted : ''} ${over === pos || sel === pos ? s.tileOver : ''} ${peerOn ? s.tileOther : ''} ${flash === pos ? s.tileFlash : ''}`}
                style={crop(mosaic, section.idx, g, piece)} aria-label={`قطعة ${ar(piece + 1)}${piece === pos ? '، في مكانها' : ''}`} aria-pressed={sel === pos}
                onPointerDown={(e) => onDown(e, pos)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => tap(pos)} />
            );
          })}
          {Object.entries(peers).map(([id, p]) => (
            <div key={id} className={s.peer} data-testid="peer" style={{ ...crop(mosaic, section.idx, g, p.piece), width: tileW, height: tileW * (mosaic.height / mosaic.rows) / (mosaic.width / mosaic.cols), transform: `translate(${p.x * bw.w}px, ${p.y * bw.h}px) scale(1.06)`, left: 0, top: 0 }}>
              <span className={s.peerName}>{nameOf(id)}</span>
            </div>
          ))}
        </div>
        {drag?.active && <div className={s.ghost} style={{ ...crop(mosaic, section.idx, g, drag.piece), width: drag.w, height: drag.h, transform: `translate(${drag.left + drag.dx}px, ${drag.top + drag.dy}px) scale(1.08)` }} aria-hidden="true" />}
      </section>
      <aside className={s.side}>
        {done && <p className="notice notice-ok" role="status" data-testid="grand-section-done">اكتمل جزء صفكم! يظهر الآن في <Link href="/grand">اللوحة الكبرى</Link> وعليه اسم مدرستكم.</p>}
        <div>
          <h2 style={{ fontSize: 'var(--step-1)' }}>معك الآن <span style={{ fontSize: '.8rem', color: live ? 'var(--olive-text)' : 'var(--ink-2)' }}>{live ? '· متصل' : '· يتصل…'}</span></h2>
          <ul className={s.who} data-testid="online">{online.map((id) => <li key={id}>{nameOf(id)}</li>)}</ul>
        </div>
        <div>
          <h2 style={{ fontSize: 'var(--step-1)' }}>ما يجري</h2>
          <ul className={s.feed} aria-live="polite">{feed.length ? feed.map((f, i) => <li key={i + f}>{f}</li>) : <li>حين يعيد زميل قطعة إلى مكانها تراه هنا.</li>}</ul>
        </div>
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>لا كتابة هنا ولا رسائل: يرى زملاؤك حركة القطع وأسماءكم المستعارة فقط.</p>
      </aside>
    </div>
  );
}
