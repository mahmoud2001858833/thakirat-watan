// يتحقق من تباين ألوان النص (WCAG AA: 4.5 للنص العادي، 3 للنص الكبير وعناصر الواجهة)
const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const R = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const bgs = { ivory: '#F7F2E8', sand: '#EDE2CE', paper: '#FBF7EF' };
const text = { ink: '#2A2420', ink2: '#5C5149', petraText: '#8E4C39', oliveText: '#566139', goldText: '#7A5A1F', danger: '#9B2F1F' };
const large = { petra: '#C4836F', olive: '#6E7B4F', gold: '#B58A3C' };
let ok = true;
for (const [bn, b] of Object.entries(bgs)) {
  for (const [n, c] of Object.entries(text)) { const r = R(c, b); if (r < 4.5) ok = false; console.log(`${bn.padEnd(6)} ${n.padEnd(10)} ${r.toFixed(2)} ${r >= 4.5 ? 'AA' : 'FAIL'}`); }
  for (const [n, c] of Object.entries(large)) { const r = R(c, b); console.log(`${bn.padEnd(6)} ${n.padEnd(10)} ${r.toFixed(2)} ${r >= 3 ? 'large/UI' : 'decor only'}`); }
}
// زر أساسي: نص عاجي على الحبر، ونص الحبر على البترا
for (const [n, f, b] of [['btn ink', '#FBF7EF', '#2A2420'], ['btn petra', '#2A2420', '#C4836F'], ['btn petraText', '#FBF7EF', '#8E4C39']]) {
  const r = R(f, b); if (r < 4.5) ok = false; console.log(`${n.padEnd(17)} ${r.toFixed(2)}`);
}
process.exit(ok ? 0 : 1);
