'use client';
import { useEffect, useRef, useState } from 'react';
import { play, buzz } from '@/lib/client/sound';
import s from './dial.module.css';

const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const key = (mo: number, d: number) => `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** دولاب التاريخ: حلقة خارجية للأشهر وحلقة داخلية للأيام، تُدار بالسحب أو العجلة أو الأسهم.
 *  القيمة المختارة هي ما يقف تحت المؤشر في الأعلى. */
export function DateDial({ months, value, marked, today, onPick }: { months: string[]; value: string; marked: string[]; today: string; onPick: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mo, setMo] = useState(+value.slice(0, 2));
  const [d, setD] = useState(+value.slice(3, 5));
  // زاوية كل حلقة بالدرجات (مستمرة أثناء السحب)
  const [rot, setRot] = useState({ m: -(mo - 1) * 30, d: -(d - 1) * (360 / 31) });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ ring: 'm' | 'd'; a0: number; r0: number; last: number } | null>(null);
  const [ringDrag, setRingDrag] = useState<'m' | 'd' | null>(null);
  const markedSet = new Set(marked);
  const dIn = DAYS_IN[mo - 1];

  useEffect(() => {
    if (!open) return;
    const m = +value.slice(0, 2), dd = +value.slice(3, 5);
    setMo(m); setD(dd); setRot({ m: -(m - 1) * 30, d: -(dd - 1) * (360 / 31) }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open, value]);

  const angleAt = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    return { a: (Math.atan2(y, x) * 180) / Math.PI, dist: Math.hypot(x, y) / (r.width / 2) };
  };
  const idxFrom = (ring: 'm' | 'd', deg: number) => {
    const n = ring === 'm' ? 12 : 31, step = 360 / n;
    return ((Math.round(-deg / step) % n) + n) % n;
  };
  const down = (e: React.PointerEvent) => {
    const { a, dist } = angleAt(e);
    if (dist < 0.28 || dist > 1.02) return;
    const ring = dist > 0.68 ? 'm' : 'd';
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { ring, a0: a, r0: rot[ring], last: idxFrom(ring, rot[ring]) }; setRingDrag(ring);
  };
  const move = (e: React.PointerEvent) => {
    const g = drag.current; if (!g) return;
    let da = angleAt(e).a - g.a0; if (da > 180) da -= 360; if (da < -180) da += 360;
    const r = g.r0 + da; g.a0 += da; g.r0 = r;
    setRot((o) => ({ ...o, [g.ring]: r }));
    const i = idxFrom(g.ring, r);
    if (i !== g.last) {
      g.last = i; play('wheel'); buzz(4);
      if (g.ring === 'm') { setMo(i + 1); setD((x) => Math.min(x, DAYS_IN[i])); } else setD(Math.min(i + 1, dIn));
    }
  };
  const up = () => {
    const g = drag.current; drag.current = null; setRingDrag(null); if (!g) return;
    const n = g.ring === 'm' ? 12 : 31, step = 360 / n;
    setRot((o) => ({ ...o, [g.ring]: Math.round(o[g.ring] / step) * step }));
  };
  const nudge = (ring: 'm' | 'd', by: number) => {
    const n = ring === 'm' ? 12 : 31, step = 360 / n;
    setRot((o) => ({ ...o, [ring]: o[ring] - by * step }));
    play('wheel');
    if (ring === 'm') { const m = ((mo - 1 + by + 12) % 12) + 1; setMo(m); setD((x) => Math.min(x, DAYS_IN[m - 1])); }
    else setD(((d - 1 + by + dIn) % dIn) + 1);
  };
  const keys = (ring: 'm' | 'd') => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(ring, 1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(ring, -1); }
    if (e.key === 'Enter') { e.preventDefault(); go(); }
  };
  const go = () => { setOpen(false); onPick(key(mo, Math.min(d, dIn))); };

  const R = 150, mR = 126, dR = 82;
  return (
    <div className={s.wrap}>
      <button type="button" className={`btn ${s.toggle}`} aria-expanded={open} onClick={() => { setOpen(!open); play('tap'); }} data-testid="dial-toggle">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 1.5v4" /></svg>
        دولاب التاريخ
      </button>
      {open && <div className={s.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <div className={s.pop} role="dialog" aria-label="دولاب التاريخ">
          <svg ref={svg} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} className={s.dial} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            onWheel={(e) => { const { dist } = angleAt(e); nudge(dist > 0.68 ? 'm' : 'd', e.deltaY > 0 ? 1 : -1); }} data-testid="dial">
            <defs>
              <radialGradient id="dialWood" cx="40%" cy="35%"><stop offset="0" stopColor="#f6ecd9" /><stop offset="1" stopColor="#e2d0ae" /></radialGradient>
            </defs>
            <circle r={R - 2} fill="url(#dialWood)" stroke="#8a6a3a" strokeWidth="2" />
            <g transform={`rotate(${rot.m})`} className={ringDrag === 'm' ? '' : s.spin}>
              {months.map((m, i) => {
                const a = i * 30 - 90;
                return (
                  <g key={m} transform={`rotate(${a}) translate(${mR} 0) rotate(90)`}>
                    <text className={`${s.mText} ${i + 1 === mo ? s.on : ''}`} textAnchor="middle" dominantBaseline="middle">{m}</text>
                  </g>
                );
              })}
            </g>
            <circle r={104} fill="#fbf6ea" stroke="#b58a3c" strokeWidth="1" />
            <g transform={`rotate(${rot.d})`} className={ringDrag === 'd' ? '' : s.spin}>
              {Array.from({ length: 31 }, (_, i) => {
                const a = i * (360 / 31) - 90, has = markedSet.has(key(mo, i + 1)), off = i + 1 > dIn;
                return (
                  <g key={i} transform={`rotate(${a}) translate(${dR} 0) rotate(90)`} opacity={off ? 0.25 : 1}>
                    <text className={`${s.dText} ${i + 1 === d ? s.on : ''}`} textAnchor="middle" dominantBaseline="middle">{ar(i + 1)}</text>
                    {has && <circle cy="-13" r="2.6" className={s.mark} />}
                  </g>
                );
              })}
            </g>
            <circle r={52} fill="#2a2420" />
            <text className={s.center} textAnchor="middle" y="-6">{ar(Math.min(d, dIn))}</text>
            <text className={s.centerSm} textAnchor="middle" y="18">{months[mo - 1]}</text>
            <path d={`M-9 ${-R + 1} L9 ${-R + 1} L0 ${-R + 18} Z`} className={s.pointer} />
          </svg>
          <div className={s.rings}>
            <span tabIndex={0} role="slider" aria-label="الشهر" aria-valuemin={1} aria-valuemax={12} aria-valuenow={mo} aria-valuetext={months[mo - 1]} onKeyDown={keys('m')} className={s.kb}>الشهر: {months[mo - 1]}</span>
            <span tabIndex={0} role="slider" aria-label="اليوم" aria-valuemin={1} aria-valuemax={dIn} aria-valuenow={d} aria-valuetext={ar(d)} onKeyDown={keys('d')} className={s.kb}>اليوم: {ar(Math.min(d, dIn))}</span>
          </div>
          <p className={s.legend}><span className={s.dotLegend} aria-hidden="true" /> أيام فيها أحداث موثقة</p>
          <div className={s.actions}>
            <button type="button" className="btn btn-primary" onClick={go} data-testid="dial-go">افتح صفحة {ar(Math.min(d, dIn))} {months[mo - 1]}</button>
            <button type="button" className="btn btn-quiet" onClick={() => { setOpen(false); onPick(today); }}>اليوم</button>
          </div>
        </div>
      )}
    </div>
  );
}
