'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GOV_TONES, W, growTree, leafPaths, paintBackdrop, paintTree, visitorLeaves, type TreeState } from './tree';
import s from './olive.module.css';

type Gov = { id: string; key: string; name_ar: string };
type Data = { ids: string[]; g: number[]; s: (string | null)[] };
type View = { k: number; x: number; y: number }; // مقياس وإزاحة (بكسل الشاشة)
const PAD = 200; // هامش الذاكرة حتى لا تُقص أطراف الأغصان

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function OliveCanvas({ state, govs, buds, filterGov, filterSchool, onPick, onData }: {
  state: TreeState; govs: Gov[]; buds: { id: string; g: number }[];
  filterGov: number | null; filterSchool: string | null; onPick: (id: string) => void; onData?: (d: Data) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null), bg = useRef<HTMLCanvasElement>(null), fg = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<Data | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const view = useRef<View>({ k: 1, x: 0, y: 0 });
  const cache = useRef<{ canvas: HTMLCanvasElement; scale: number } | null>(null);
  const raf = useRef(0), anim = useRef<number | null>(null), budT = useRef(0), moving = useRef(false), idle = useRef(0);
  const tree = useMemo(() => growTree(state.branches), [state.branches]);

  useEffect(() => {
    let live = true;
    fetch('/api/olive/leaves', { cache: 'no-store' }).then((r) => r.json()).then((d: Data) => { if (live) { setData(d); onData?.(d); } }).catch(() => {});
    return () => { live = false; };
  }, [onData]);

  const pos = useMemo(() => (data ? visitorLeaves(tree, data.ids, data.g) : new Float32Array()), [data, tree]);
  const paths = useMemo(() => data ? leafPaths(pos, data.g, (i) =>
    (filterGov === null || data.g[i] === filterGov) && (!filterSchool || data.s[i] === filterSchool)) : null, [data, pos, filterGov, filterSchool]);
  const budPos = useMemo(() => visitorLeaves(tree, buds.map((b) => b.id), buds.map((b) => b.g)), [tree, buds]);

  // الملاءمة: الشجرة كاملة في الإطار
  const fit = useCallback((w: number, h: number): View => {
    const k = Math.min(w / (W * 0.86), h / (W * 0.82));
    return { k, x: (w - W * k) / 2, y: h - W * k * 0.99 };
  }, []);

  const draw = useCallback(() => {
    raf.current = 0;
    const c = fg.current; if (!c || !cache.current) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), ctx = c.getContext('2d')!, v = view.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(v.k * dpr, 0, 0, v.k * dpr, v.x * dpr, v.y * dpr);
    ctx.drawImage(cache.current.canvas, -PAD, -PAD, W + PAD * 2, W + PAD * 2);
    if (paths) {
      if (filterGov !== null || filterSchool) { ctx.globalAlpha = 0.28; ctx.fillStyle = '#6f7a5c'; ctx.fill(paths.off); ctx.globalAlpha = 1; }
      paths.on.forEach((p, i) => { ctx.fillStyle = GOV_TONES[i]; ctx.fill(p); });
      // إطار ذهبي يميّز أوراق الناس؛ يُرسم عند السكون، أو دائماً حين تكون الأوراق قليلة
      if (!moving.current || (data?.ids.length ?? 0) < 2500) {
        ctx.lineWidth = Math.max(0.9, 1.4 / v.k); ctx.strokeStyle = '#e2c37a';
        paths.on.forEach((p) => ctx.stroke(p));
      }
    }
    // براعم صاحب الجلسة: تنمو بهدوء
    const grow = Math.min(1, budT.current);
    for (let i = 0; i < buds.length; i++) {
      const x = budPos[i * 3], y = budPos[i * 3 + 1];
      ctx.fillStyle = '#c4836f'; ctx.beginPath(); ctx.ellipse(x, y, 4.5 * grow, 6.5 * grow, budPos[i * 3 + 2], 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fbf7ef'; ctx.lineWidth = 1; ctx.stroke();
    }
  }, [paths, buds, budPos, filterGov, filterSchool]);
  const schedule = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(draw); }, [draw]);
  // أثناء الحركة نخفف الرسم، وبعد توقفها بقليل نرسم التفاصيل كاملة
  const motion = useCallback(() => {
    moving.current = true; clearTimeout(idle.current);
    idle.current = window.setTimeout(() => { moving.current = false; schedule(); }, 160);
  }, [schedule]);

  // ذاكرة الشجرة المرسومة بدقة تناسب التكبير
  const rebuild = useCallback(() => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const scale = Math.min(4, Math.max(1, view.current.k * dpr));
    if (cache.current && Math.abs(cache.current.scale - scale) < 0.35) return;
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.round((W + PAD * 2) * Math.min(scale, 3.2));
    const sc = cv.width / (W + PAD * 2);
    const ctx = cv.getContext('2d')!; ctx.scale(sc, sc); ctx.translate(PAD, PAD); paintTree(ctx, tree, state);
    cache.current = { canvas: cv, scale }; schedule();
  }, [tree, state, schedule]);

  // القياس والخلفية
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!size.w) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const c of [bg.current!, fg.current!]) { c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr); }
    const b = bg.current!.getContext('2d')!; b.setTransform(dpr, 0, 0, dpr, 0, 0); paintBackdrop(b, size.w, size.h, state.season);
    view.current = fit(size.w, size.h); cache.current = null; rebuild(); schedule();
  }, [size, fit, rebuild, schedule, state.season]);
  useEffect(() => { schedule(); }, [schedule]);

  // نمو البراعم
  useEffect(() => {
    if (!buds.length) return;
    if (reduce()) { budT.current = 1; schedule(); return; }
    let start = 0, id = 0;
    const step = (t: number) => { start ||= t; budT.current = Math.min(1, (t - start) / 900); schedule(); if (budT.current < 1) id = requestAnimationFrame(step); };
    id = requestAnimationFrame(step); return () => cancelAnimationFrame(id);
  }, [buds, schedule]);

  // الانتقال السلس إلى غصن المحافظة
  const animateTo = useCallback((target: View) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    if (reduce()) { view.current = target; rebuild(); schedule(); return; }
    const from = { ...view.current }; let t0 = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => {
      t0 ||= t; const p = Math.min(1, (t - t0) / 700), e = ease(p);
      view.current = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      schedule(); if (p < 1) anim.current = requestAnimationFrame(step); else { anim.current = null; rebuild(); }
    };
    anim.current = requestAnimationFrame(step);
  }, [rebuild, schedule]);
  useEffect(() => {
    if (!size.w) return;
    if (filterGov === null) { animateTo(fit(size.w, size.h)); return; }
    const b = tree.bounds[filterGov], pad = 40;
    const k = Math.min(size.w / (b.x1 - b.x0 + pad * 2), size.h / (b.y1 - b.y0 + pad * 2), 3.2);
    animateTo({ k, x: size.w / 2 - ((b.x0 + b.x1) / 2) * k, y: size.h / 2 - ((b.y0 + b.y1) / 2) * k });
  }, [filterGov, size, tree, fit, animateTo]);

  // التحريك والتكبير
  const pointers = useRef(new Map<number, { x: number; y: number }>()), moved = useRef(0), pinch = useRef(0);
  const zoomAt = (sx: number, sy: number, f: number) => {
    const v = view.current, k = Math.min(8, Math.max(0.4, v.k * f)), r = k / v.k;
    view.current = { k, x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r }; motion(); schedule();
  };
  useEffect(() => {
    const c = fg.current; if (!c) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = c.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); clearTimeout(moved.current); moved.current = window.setTimeout(rebuild, 180); };
    c.addEventListener('wheel', wheel, { passive: false }); return () => c.removeEventListener('wheel', wheel);
  });

  const pick = (sx: number, sy: number) => {
    if (!data) return;
    const v = view.current, wx = (sx - v.x) / v.k, wy = (sy - v.y) / v.k, rad = Math.max(9, 14 / v.k);
    let best = -1, bd = rad * rad;
    for (let i = 0; i < data.ids.length; i++) {
      if (filterGov !== null && data.g[i] !== filterGov) continue;
      const dx = pos[i * 3] + Math.cos(pos[i * 3 + 2]) * 7 - wx, dy = pos[i * 3 + 1] + Math.sin(pos[i * 3 + 2]) * 7 - wy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) onPick(data.ids[best]);
  };

  return (
    <div className={s.stage} ref={wrap}>
      <canvas ref={bg} className={s.canvas} aria-hidden="true" />
      <canvas ref={fg} className={s.canvas} role="img" tabIndex={0} data-testid="olive-canvas"
        aria-label={`شجرة زيتون عتيقة فيها ${state.total} ورقة منشورة. اسحب للتنقل، والعجلة أو الإصبعين للتكبير، واضغط ورقة لتقرأ ذكراها. القائمة أسفل الشجرة بديل نصي.`}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0; }}
        onPointerMove={(e) => {
          const p = pointers.current.get(e.pointerId); if (!p) return;
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]; const d0 = Math.hypot(a.x - b.x, a.y - b.y);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const [a2, b2] = [...pointers.current.values()]; const d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
            const r = fg.current!.getBoundingClientRect();
            if (d0 > 0) zoomAt((a2.x + b2.x) / 2 - r.left, (a2.y + b2.y) / 2 - r.top, d1 / d0); pinch.current = 1; return;
          }
          const dx = e.clientX - p.x, dy = e.clientY - p.y; moved.current += Math.abs(dx) + Math.abs(dy);
          view.current = { ...view.current, x: view.current.x + dx, y: view.current.y + dy };
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); motion(); schedule();
        }}
        onPointerUp={(e) => {
          const r = fg.current!.getBoundingClientRect();
          if (moved.current < 6 && !pinch.current) pick(e.clientX - r.left, e.clientY - r.top);
          pointers.current.delete(e.pointerId); if (!pointers.current.size) { pinch.current = 0; rebuild(); }
        }}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onKeyDown={(e) => {
          const step = 40, v = view.current;
          const keys: Record<string, () => void> = {
            ArrowLeft: () => { view.current = { ...v, x: v.x + step }; }, ArrowRight: () => { view.current = { ...v, x: v.x - step }; },
            ArrowUp: () => { view.current = { ...v, y: v.y + step }; }, ArrowDown: () => { view.current = { ...v, y: v.y - step }; },
            '+': () => zoomAt(size.w / 2, size.h / 2, 1.25), '=': () => zoomAt(size.w / 2, size.h / 2, 1.25), '-': () => zoomAt(size.w / 2, size.h / 2, 0.8),
            '0': () => animateTo(fit(size.w, size.h)),
          };
          if (keys[e.key]) { e.preventDefault(); keys[e.key](); schedule(); rebuild(); }
        }} />
      <div className={s.zoom}>
        <button type="button" onClick={() => { zoomAt(size.w / 2, size.h / 2, 1.3); rebuild(); }} aria-label="كبّر">+</button>
        <button type="button" onClick={() => { zoomAt(size.w / 2, size.h / 2, 0.77); rebuild(); }} aria-label="صغّر">−</button>
        <button type="button" onClick={() => animateTo(fit(size.w, size.h))} aria-label="الشجرة كاملة">⤢</button>
      </div>
      {!data && <p className={s.loadingNote} role="status">تُحمَّل الأوراق…</p>}
      <span className="sr-only">{govs.length} غصناً للمحافظات</span>
    </div>
  );
}
