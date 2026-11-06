import s from './arch.module.css';

// العقد: 13 حجراً بين نصف قطر 50 و64 حول (50,50)، وحجر الغلق أعلى قليلاً
const R1 = 50, R2 = 64, N = 13;
const pt = (r: number, a: number) => [50 + r * Math.cos(a), 50 - r * Math.sin(a)].map((v) => +v.toFixed(2));
const voussoirs = Array.from({ length: N }, (_, i) => {
  const a0 = Math.PI - (i * Math.PI) / N, a1 = Math.PI - ((i + 1) * Math.PI) / N;
  const outer = i === (N - 1) / 2 ? R2 + 5 : R2;
  const [x0, y0] = pt(R1, a0), [x1, y1] = pt(R1, a1), [x2, y2] = pt(outer, a1), [x3, y3] = pt(outer, a0);
  return { d: `M${x0},${y0} A${R1},${R1} 0 0 1 ${x1},${y1} L${x2},${y2} A${outer},${outer} 0 0 0 ${x3},${y3} Z`, tone: i % 3 };
});
const jamb = (x: number) => [50, 72, 94, 116].map((y, i) => ({ x, y, h: i === 3 ? 22 : 22, tone: (i + (x > 50 ? 1 : 0)) % 3 }));

/** إطار القوس الحجري. صندوقه (0..100 × 0..138) يطابق فتحة الجدار تماماً. */
export function ArchFrame() {
  return (
    <svg className={s.frame} viewBox="-16 -18 132 166" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="soffit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2420" stopOpacity=".22" />
          <stop offset=".5" stopColor="#2a2420" stopOpacity="0" />
          <stop offset="1" stopColor="#2a2420" stopOpacity=".16" />
        </linearGradient>
      </defs>
      {/* ظل داخلي يعطي عمق الجدار */}
      <path d="M0,138 V50 A50,50 0 0 1 100,50 V138 H96 V50.5 A46,46 0 0 0 4,50.5 V138 Z" fill="url(#soffit)" className={s.soffit} />
      {jamb(-14).concat(jamb(100)).map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width="14" height={b.h} className={s[`t${b.tone}`]} />
      ))}
      {/* حجرا الكتفين */}
      <rect x="-16" y="44" width="18" height="7" className={s.t1} />
      <rect x="98" y="44" width="18" height="7" className={s.t1} />
      {voussoirs.map((v, i) => <path key={i} d={v.d} className={s[`t${v.tone}`]} />)}
      {/* العتبة */}
      <rect x="-16" y="138" width="132" height="8" className={s.sill} />
    </svg>
  );
}
