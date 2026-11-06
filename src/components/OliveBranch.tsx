// غصن زيتون مرسوم بالكود: أوراق رمحية فضية مخضرة على طول منحنى، وزيتونات ذهبية
const N = 26;
const at = (t: number) => {
  // منحنى بيزييه تكعيبي للغصن
  const p = [[30, 330], [190, 250], [380, 150], [600, 70]];
  const u = 1 - t;
  return [0, 1].map((k) => u ** 3 * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t ** 3 * p[3][k]);
};
const leaves = Array.from({ length: N }, (_, i) => {
  const t = 0.06 + (i / N) * 0.9;
  const [x, y] = at(t);
  const [x2, y2] = at(Math.min(1, t + 0.01));
  const dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
  const side = i % 2 ? 1 : -1;
  const len = 92 - t * 34 + ((i * 7) % 5) * 4;
  return { x, y, ang: dir + side * (34 + ((i * 13) % 4) * 6), len, tone: (i * 5) % 3 };
});
const olives = [0.34, 0.5, 0.62, 0.78].map((t, i) => { const [x, y] = at(t); return { x, y, s: i % 2 ? 1 : -1 }; });
const leaf = (len: number) => `M0,0 C${len * 0.3},${-len * 0.13} ${len * 0.75},${-len * 0.1} ${len},0 C${len * 0.75},${len * 0.1} ${len * 0.3},${len * 0.13} 0,0 Z`;

export function OliveBranch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 400" role="img" aria-label="رسم غصن زيتون">
      <path d="M30,330 C190,250 380,150 600,70" fill="none" stroke="#6b5a45" strokeWidth="6" strokeLinecap="round" />
      {olives.map((o, i) => (
        <g key={`o${i}`} transform={`translate(${o.x} ${o.y})`}>
          <path d={`M0,0 Q${o.s * 6},14 ${o.s * 4},26`} stroke="#6b5a45" strokeWidth="2.5" fill="none" />
          <ellipse cx={o.s * 5} cy="42" rx="13" ry="18" fill="#b58a3c" />
          <ellipse cx={o.s * 1} cy="35" rx="3.5" ry="6" fill="#f6e5bb" opacity=".75" />
        </g>
      ))}
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.ang.toFixed(1)})`}>
          <path d={leaf(l.len)} fill={['#6e7b4f', '#8e9a6f', '#5c6842'][l.tone]} />
          <path d={`M4,0 L${l.len - 6},0`} stroke="#c9d0b0" strokeOpacity=".5" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}
