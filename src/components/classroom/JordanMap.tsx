'use client';
import { useEffect, useRef, useState } from 'react';
import { GOVERNORATES, MAP_CREDIT, MAP_H, MAP_W, project } from '@/lib/jordan-map';
import s from './ui.module.css';

export type MapPoint = { lat: number; lng: number; label: string };

/** خريطة الأردن بمحافظاتها. بين المدرستين قوس يضيء كلما وصلت رسالة (pulse يتغير). */
export function JordanMap({ a, b, pulse = 0, highlight = [], waiting = [], label }: {
  a?: MapPoint | null; b?: MapPoint | null; pulse?: number; highlight?: string[]; waiting?: string[]; label: string;
}) {
  const path = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const pa = a ? project(a.lat, a.lng) : null, pb = b ? project(b.lat, b.lng) : null;
  // قوس منحنٍ بين النقطتين
  const arc = pa && pb ? (() => {
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy);
    const cx = mx - (dy / d) * d * 0.28, cy = my + (dx / d) * d * 0.28;
    return `M${pa.x},${pa.y} Q${cx},${cy} ${pb.x},${pb.y}`;
  })() : null;
  useEffect(() => { if (path.current) setLen(path.current.getTotalLength()); }, [arc]); // eslint-disable-line react-hooks/set-state-in-effect
  // نبضة ضوء تعبر القوس مع كل رسالة جديدة
  useEffect(() => {
    const p = path.current; if (!p || !len || !pulse || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    p.animate([{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }],
      { duration: 1800, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }, [pulse, len]);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`-10 -10 ${MAP_W + 20} ${MAP_H + 20}`} className={s.map} role="img" aria-label={label}>
        {Object.entries(GOVERNORATES).map(([k, d]) => (
          <path key={k} d={d} className={`${s.gov} ${highlight.includes(k) ? s.govOn : waiting.includes(k) ? s.govWait : ''}`} />
        ))}
        {arc && <path d={arc} className={s.arc} />}
        {arc && <path ref={path} d={arc} className={s.arcGlow} style={{ strokeDasharray: len, strokeDashoffset: len, opacity: 0 }} data-testid="twin-arc" />}
        {[pa && a && { ...pa, label: a.label }, pb && b && { ...pb, label: b.label }].filter(Boolean).map((p, i) => p && (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="7" className={s.dot} />
            <text x={p.x + 12} y={p.y + 4} className={s.dotLabel} textAnchor="start">{p.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className={s.mapCredit}><a href={MAP_CREDIT.url} target="_blank" rel="noopener noreferrer">{MAP_CREDIT.text}</a></figcaption>
    </figure>
  );
}
