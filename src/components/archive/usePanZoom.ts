'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type View = { s: number; x: number; y: number };
type Size = { w: number; h: number };

/** تكبير وتحريك بالسحب والقرص وعجلة الفأرة ولوحة المفاتيح، مع قصور ذاتي عند الإفلات.
 *  التحويل: translate(x,y) scale(s) والأصل في الزاوية العليا اليسرى. s=1 يعني «ملء الإطار». */
export function usePanZoom(img: Size, opts: { max?: number; onChange?: (v: View) => void } = {}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const v = useRef(view);
  const [dims, setDims] = useState({ bw: 0, bh: 0 });
  const fit = useRef({ base: 1, bw: 0, bh: 0, cw: 0, ch: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; t: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number } | null>(null);
  const raf = useRef(0);
  const max = opts.max ?? 8;
  const onChange = useRef(opts.onChange);
  useEffect(() => { onChange.current = opts.onChange; });

  const clamp = useCallback((n: View): View => {
    const { bw, bh, cw, ch } = fit.current;
    const s = Math.min(max, Math.max(1, n.s));
    const w = bw * s, h = bh * s;
    // الصورة أصغر من الإطار: تتوسط. أكبر: لا تخرج حوافها إلى الداخل
    const x = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, n.x));
    const y = h <= ch ? (ch - h) / 2 : Math.min(0, Math.max(ch - h, n.y));
    return { s, x, y };
  }, [max]);

  const commit = useCallback((n: View, silent = false) => {
    const c = clamp(n); v.current = c; setView(c);
    if (!silent) onChange.current?.(c);
  }, [clamp]);

  const measure = useCallback(() => {
    const el = boxRef.current; if (!el || !img.w) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const base = Math.min(cw / img.w, ch / img.h);
    const prev = fit.current;
    fit.current = { base, bw: img.w * base, bh: img.h * base, cw, ch };
    setDims({ bw: img.w * base, bh: img.h * base });
    if (!prev.cw) commit({ s: 1, x: 0, y: 0 }, true); else commit(v.current, true);
  }, [img.w, img.h, commit]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [measure]);

  /** تكبير حول نقطة (cx,cy) داخل الإطار */
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const { cw, ch } = fit.current; const c = v.current;
    const px = cx ?? cw / 2, py = cy ?? ch / 2;
    const s = Math.min(max, Math.max(1, c.s * factor)); const k = s / c.s;
    commit({ s, x: px - (px - c.x) * k, y: py - (py - c.y) * k });
  }, [commit, max]);

  const reset = useCallback(() => commit({ s: 1, x: 0, y: 0 }), [commit]);
  const set = useCallback((n: View) => commit(n, true), [commit]);

  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const rel = (e: { clientX: number; clientY: number }) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); const p = rel(e);
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), p.x, p.y);
    };
    let lastTap = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(raf.current);
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, rel(e));
      const now = performance.now();
      if (pointers.current.size === 1) {
        if (now - lastTap < 280) { const p = rel(e); if (v.current.s > 1.05) reset(); else zoomAt(2.6, p.x, p.y); lastTap = 0; return; }
        lastTap = now;
        const p = rel(e); last.current = { ...p, t: now, vx: 0, vy: 0 };
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.current.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
      el.dataset.grabbing = 'true';
    };
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = rel(e); pointers.current.set(e.pointerId, p);
      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const target = pinch.current.s * (d / pinch.current.d);
        const c = v.current; const s = Math.min(max, Math.max(1, target)); const k = s / c.s;
        commit({ s, x: cx - (cx - c.x) * k + (cx - pinch.current.cx), y: cy - (cy - c.y) * k + (cy - pinch.current.cy) });
        pinch.current.cx = cx; pinch.current.cy = cy;
      } else if (last.current) {
        const now = performance.now(), dt = Math.max(1, now - last.current.t);
        const dx = p.x - last.current.x, dy = p.y - last.current.y;
        last.current = { x: p.x, y: p.y, t: now, vx: dx / dt, vy: dy / dt };
        commit({ ...v.current, x: v.current.x + dx, y: v.current.y + dy });
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 1) { const [p] = [...pointers.current.values()]; last.current = { ...p, t: performance.now(), vx: 0, vy: 0 }; return; }
      delete el.dataset.grabbing;
      const l = last.current; last.current = null;
      if (!l || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // قصور ذاتي
      let vx = l.vx * 16, vy = l.vy * 16;
      const step = () => {
        vx *= 0.92; vy *= 0.92;
        if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) return;
        commit({ ...v.current, x: v.current.x + vx, y: v.current.y + vy });
        raf.current = requestAnimationFrame(step);
      };
      if (Math.hypot(vx, vy) > 2) raf.current = requestAnimationFrame(step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('wheel', onWheel); el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      cancelAnimationFrame(raf.current);
    };
  }, [commit, zoomAt, reset, max]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key, step = 60;
    if (k === '+' || k === '=') zoomAt(1.4);
    else if (k === '-' || k === '_') zoomAt(1 / 1.4);
    else if (k === '0') reset();
    else if (k === 'ArrowLeft') commit({ ...v.current, x: v.current.x + step });
    else if (k === 'ArrowRight') commit({ ...v.current, x: v.current.x - step });
    else if (k === 'ArrowUp') commit({ ...v.current, y: v.current.y + step });
    else if (k === 'ArrowDown') commit({ ...v.current, y: v.current.y - step });
    else return;
    e.preventDefault();
  }, [zoomAt, reset, commit]);

  const style: React.CSSProperties = {
    width: dims.bw || undefined, height: dims.bh || undefined,
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
  };
  return { boxRef, view, style, zoomAt, reset, set, onKeyDown, ratio: view.s };
}
