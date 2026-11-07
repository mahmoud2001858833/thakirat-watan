'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { drawFrame, layout, spawnDust, stoneTexture, type Dust, type Layout, type Material } from './carve';
import { play, buzz } from '@/lib/client/sound';
import s from './name.module.css';

export type StoneHandle = { snapshot: (W: number, H: number) => Promise<HTMLCanvasElement> };

const PER = 520, GAP = 120; // مدة نقش الحرف والفاصل بين الحروف (ملّي ثانية)

/** الحجر: تُنقش عليه الحروف واحداً واحداً بالإزميل، ويتحرك الضوء مع الفأرة أو الإصبع */
export const CarvedStone = forwardRef<StoneHandle, { text: string; font: string; material: Material; label: string }>(
  function CarvedStone({ text, font, material, label }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const cv = useRef<HTMLCanvasElement>(null);
    const st = useRef({
      W: 0, H: 0, dpr: 1, tex: null as HTMLCanvasElement | null, lay: { glyphs: [], size: 0 } as Layout, t0: 0,
      light: { x: 0, y: 0 }, target: { x: 0, y: 0 }, dust: [] as Dust[], lastHit: 0, raf: 0, scratch: null as [HTMLCanvasElement, HTMLCanvasElement] | null,
      reduce: false, done: false, mat: material, font, text,
    });
    const [carving, setCarving] = useState(false);

    // تهيئة الحجم والملمس
    useEffect(() => {
      const S = st.current; S.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fit = () => {
        const el = box.current, c = cv.current; if (!el || !c) return;
        const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(el.clientWidth * dpr), H = Math.round(el.clientHeight * dpr);
        if (W === S.W && H === S.H) return;
        Object.assign(S, { W, H, dpr }); c.width = W; c.height = H;
        S.tex = stoneTexture(S.mat, W, H);
        const mk = () => { const x = document.createElement('canvas'); x.width = W; x.height = H; return x; };
        S.scratch = [mk(), mk()];
        S.light = { x: W * 0.22, y: H * 0.12 }; S.target = { ...S.light };
        relayout(false);
      };
      const ro = new ResizeObserver(fit); if (box.current) ro.observe(box.current);
      fit();
      return () => { ro.disconnect(); cancelAnimationFrame(S.raf); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function relayout(restart: boolean) {
      const S = st.current, c = cv.current; if (!c || !S.W) return;
      const g = c.getContext('2d')!;
      S.lay = layout(g, S.text, S.font, S.W, S.H);
      if (restart) { S.t0 = performance.now(); S.done = S.reduce; setCarving(!S.reduce); }
      else if (!S.t0) { S.t0 = performance.now(); setCarving(!S.reduce); }
      loop();
    }

    // نص أو خط أو مادة جديدة: نعيد النقش (بعد توقف قصير عن الكتابة)
    useEffect(() => {
      const S = st.current;
      const matChanged = S.mat !== material;
      S.mat = material; S.font = font; S.text = text;
      if (matChanged && S.W) S.tex = stoneTexture(material, S.W, S.H);
      let alive = true;
      const tm = setTimeout(async () => {
        try { await document.fonts.load(`80px ${font}`, text); } catch {}
        if (alive) relayout(true);
      }, matChanged ? 0 : 450);
      return () => { alive = false; clearTimeout(tm); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, font, material]);

    function loop() {
      const S = st.current; cancelAnimationFrame(S.raf);
      const tick = (now: number) => {
        const c = cv.current; if (!c || !S.tex || !S.scratch) return;
        const g = c.getContext('2d')!;
        const n = S.lay.glyphs.length;
        const el = now - S.t0;
        const progress = S.lay.glyphs.map((_, i) => (S.reduce ? 1 : Math.min(1, Math.max(0, (el - i * (PER + GAP)) / PER))));
        const cur = progress.findIndex((p) => p > 0 && p < 1);
        let chisel: { x: number; y: number; hit: number } | null = null;
        if (cur >= 0) {
          const gl = S.lay.glyphs[cur], p = progress[cur];
          const hitPhase = (el % 90) / 90; // ضربة كل 90ms
          const fx = gl.x + gl.w * (0.5 + Math.sin(el / 47) * 0.32), fy = gl.top + gl.h * p;
          chisel = { x: fx, y: fy, hit: hitPhase < 0.3 ? 1 - hitPhase / 0.3 : 0 };
          if (now - S.lastHit > 90) { S.lastHit = now; S.dust.push(...spawnDust(fx, fy, S.lay.size)); play('chisel'); if (Math.random() < 0.3) buzz(3); }
        }
        // الغبار يسقط ويتلاشى
        for (const d of S.dust) { d.vy += S.lay.size * 0.0035; d.x += d.vx; d.y += d.vy; d.life -= 0.022; }
        S.dust = S.dust.filter((d) => d.life > 0 && d.y < S.H);
        // الضوء يلحق بالإصبع بنعومة
        S.light.x += (S.target.x - S.light.x) * 0.18; S.light.y += (S.target.y - S.light.y) * 0.18;
        drawFrame(g, { W: S.W, H: S.H, tex: S.tex, mat: S.mat, font: S.font, lay: S.lay, progress, light: S.light, dust: S.dust, chisel, shake: chisel?.hit ? S.dpr * 0.8 : 0, scratch: S.scratch });
        const finished = progress.every((p) => p >= 1);
        if (finished && !S.done && n) { S.done = true; setCarving(false); play('chime'); }
        const settling = Math.hypot(S.target.x - S.light.x, S.target.y - S.light.y) > 0.5;
        if (!finished || S.dust.length || settling) S.raf = requestAnimationFrame(tick);
      };
      S.raf = requestAnimationFrame(tick);
    }

    const moveLight = (e: React.PointerEvent) => {
      const S = st.current, r = cv.current!.getBoundingClientRect();
      S.target = { x: (e.clientX - r.left) * S.dpr, y: (e.clientY - r.top) * S.dpr };
      if (S.done || S.reduce) loop();
    };
    const keyLight = (e: React.KeyboardEvent) => {
      const S = st.current, step = S.W * 0.06;
      const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!m[e.key]) return; e.preventDefault();
      S.target = { x: Math.min(S.W, Math.max(0, S.target.x + m[e.key][0])), y: Math.min(S.H, Math.max(0, S.target.y + m[e.key][1])) };
      loop();
    };

    useImperativeHandle(ref, () => ({
      async snapshot(W: number, H: number) {
        const S = st.current;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d')!;
        const tex = stoneTexture(S.mat, W, H);
        const lay = layout(g, S.text, S.font, W, H * 0.62);
        const mk = () => { const x = document.createElement('canvas'); x.width = W; x.height = H; return x; };
        drawFrame(g, { W, H, tex, mat: S.mat, font: S.font, lay, progress: lay.glyphs.map(() => 1), light: { x: W * (S.light.x / S.W || 0.25), y: H * (S.light.y / S.H || 0.12) }, dust: [], chisel: null, shake: 0, scratch: [mk(), mk()] });
        return c;
      },
    }));

    return (
      <div ref={box} className={s.stoneBox}>
        <canvas ref={cv} className={s.canvas} role="img" aria-label={label} tabIndex={0}
          onPointerMove={moveLight} onPointerDown={moveLight} onKeyDown={keyLight} data-testid="stone" data-carving={carving} />
        <button type="button" className={s.recarve} onClick={() => relayout(true)} disabled={carving}>
          {carving ? 'يُنقش الآن…' : 'انقش من جديد'}
        </button>
        <p className={s.lightHint} aria-hidden="true">حرّك الضوء على الحجر بالفأرة أو بإصبعك</p>
      </div>
    );
  },
);
