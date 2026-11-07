// زيتونة الوطن — توليد الشجرة ورسمها. كل شيء حتمي من بذرة ثابتة حتى تبقى الشجرة نفسها لكل زائر.
// عالم الرسم 1000×1000، والجذع عند (500، 940).

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TreeState = { total: number; branches: number; blooming: boolean; golden: boolean; season: Season };
type Seg = { x0: number; y0: number; c1x: number; c1y: number; c2x: number; c2y: number; x1: number; y1: number; w0: number; w1: number; depth: number; gov: number };
type Anchor = { x: number; y: number; a: number };
export type Tree = { segs: Seg[]; anchors: Anchor[][]; tips: Anchor[]; bounds: { x0: number; y0: number; x1: number; y1: number }[] };

export const W = 1000;
const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const bez = (s: Seg, t: number) => {
  const u = 1 - t;
  return {
    x: u * u * u * s.x0 + 3 * u * u * t * s.c1x + 3 * u * t * t * s.c2x + t * t * t * s.x1,
    y: u * u * u * s.y0 + 3 * u * u * t * s.c1y + 3 * u * t * t * s.c2y + t * t * t * s.y1,
  };
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const angAt = (s: Seg, t: number) => { const a = bez(s, Math.max(0, t - 0.02)), b = bez(s, Math.min(1, t + 0.02)); return Math.atan2(b.y - a.y, b.x - a.x); };

/** يولّد الأغصان: 12 غصناً رئيساً (محافظة لكل غصن) تتفرع ثلاث مرات، وأغصاناً إضافية بعدد state.branches */
export function growTree(extraBranches: number): Tree {
  const r = mulberry(1946);
  const segs: Seg[] = [], anchors: Anchor[][] = Array.from({ length: 12 }, () => []), tips: Anchor[] = [];
  const bounds = Array.from({ length: 12 }, () => ({ x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }));
  const grow = (x: number, y: number, a: number, len: number, w: number, depth: number, gov: number) => {
    const bend = (r() - 0.5) * 0.7 - 0.18; // ميل خفيف إلى الأعلى
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    const s: Seg = {
      x0: x, y0: y, x1, y1, w0: w, w1: w * 0.62, depth, gov,
      c1x: x + Math.cos(a - bend) * len * 0.35, c1y: y + Math.sin(a - bend) * len * 0.35 - (depth === 0 ? 18 : 6),
      c2x: x + Math.cos(a + bend) * len * 0.7, c2y: y + Math.sin(a + bend) * len * 0.7,
    };
    segs.push(s);
    const b = bounds[gov]; b.x0 = Math.min(b.x0, x, x1); b.x1 = Math.max(b.x1, x, x1); b.y0 = Math.min(b.y0, y, y1); b.y1 = Math.max(b.y1, y, y1);
    if (depth >= 3) {
      for (let k = 0; k < 9; k++) { const t = 0.3 + (k / 9) * 0.7; const p = bez(s, t); anchors[gov].push({ x: p.x, y: p.y, a: angAt(s, t) }); }
      tips.push({ x: x1, y: y1, a });
      return;
    }
    const kids = depth === 0 ? 3 : depth === 1 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const t = depth === 0 ? 0.45 + k * 0.22 : 0.55 + k * 0.3;
      const p = bez(s, Math.min(t, 0.98));
      const side = k % 2 ? 1 : -1;
      grow(p.x, p.y, angAt(s, t) + side * (0.35 + r() * 0.45), len * (0.52 + r() * 0.12), s.w0 * 0.6, depth + 1, gov);
    }
  };
  // ثلاثة أفرع هيكلية كما في أشجار الزيتون المعمّرة، ومن كل فرع أربعة أغصان (محافظة لكل غصن)
  const scaffolds = [
    { x: 476, y: 660, a: -2.3, len: 150 }, { x: 500, y: 630, a: -1.62, len: 120 }, { x: 524, y: 660, a: -0.84, len: 150 },
  ];
  scaffolds.forEach((sc, si) => {
    const x1 = sc.x + Math.cos(sc.a) * sc.len, y1 = sc.y + Math.sin(sc.a) * sc.len;
    const seg: Seg = { x0: sc.x, y0: sc.y, x1, y1, w0: 30, w1: 19, depth: -1, gov: si * 4,
      c1x: sc.x + Math.cos(sc.a + 0.25) * sc.len * 0.4, c1y: sc.y + Math.sin(sc.a + 0.25) * sc.len * 0.4,
      c2x: sc.x + Math.cos(sc.a - 0.2) * sc.len * 0.75, c2y: sc.y + Math.sin(sc.a - 0.2) * sc.len * 0.75 };
    segs.push(seg);
    for (let k = 0; k < 4; k++) {
      const g = si * 4 + k, t = 0.62 + k * 0.12, p = bez(seg, Math.min(t, 1));
      const spread = (k - 1.5) * 0.42 + (r() - 0.5) * 0.12;
      const a = angAt(seg, Math.min(t, 0.98)) + spread;
      const horiz = 1 - Math.abs(Math.sin(a));
      grow(p.x, p.y, a, 150 + horiz * 90 + r() * 40, 14, 0, g);
    }
  });
  // أغصان النمو: غصن جديد لكل مئة ورقة منشورة (تُحسب في قاعدة البيانات)
  const terminal = segs.filter((s) => s.depth === 2);
  for (let k = 0; k < Math.min(extraBranches, 360); k++) {
    const base = terminal[(k * 7) % terminal.length];
    const t = 0.25 + r() * 0.6, p = bez(base, t);
    grow(p.x, p.y, angAt(base, t) + (r() > 0.5 ? 1 : -1) * (0.5 + r() * 0.5), 30 + r() * 30, 2.2, 3, base.gov);
  }
  return { segs, anchors, tips, bounds };
}

// ───── الألوان ─────
const PAL: Record<Season, { leaves: string[]; bark: string[]; tint: string }> = {
  spring: { leaves: ['#6f7d4e', '#8a9867', '#a9b28c', '#5c6a42', '#b8c0a0'], bark: ['#5a4b3e', '#7a6754', '#463a30', '#9a8670'], tint: 'rgba(255,248,230,0)' },
  summer: { leaves: ['#66744a', '#7f8d5e', '#a2ab86', '#536140', '#b3ba98'], bark: ['#57483b', '#776451', '#43372d', '#97836c'], tint: 'rgba(255,236,190,.06)' },
  autumn: { leaves: ['#6a7449', '#86905f', '#a6ab84', '#58623f', '#b1b394'], bark: ['#5b4a3c', '#7c6753', '#45382e', '#9b856d'], tint: 'rgba(240,200,140,.05)' },
  winter: { leaves: ['#66715a', '#7d8873', '#9fa898', '#56614d', '#aeb6aa'], bark: ['#58504a', '#756b62', '#443d38', '#958b80'], tint: 'rgba(220,228,240,.08)' },
};
// درجة زيتية خاصة بكل محافظة (ترتيب المفاتيح أبجدياً كما في قاعدة البيانات)
export const GOV_TONES = ['#3f6b3a', '#6b8f3a', '#2f5d50', '#8a9a3a', '#4e7a2c', '#5f6f2a', '#7a8f55', '#3c7a62', '#99a04a', '#55703f', '#2f6b45', '#82963f'];

export function leafPath(p: Path2D, x: number, y: number, a: number, len: number, wid: number) {
  const ca = Math.cos(a), sa = Math.sin(a), tx = x + ca * len, ty = y + sa * len;
  const mx = x + ca * len * 0.5, my = y + sa * len * 0.5, nx = -sa * wid, ny = ca * wid;
  p.moveTo(x, y);
  p.quadraticCurveTo(mx + nx, my + ny, tx, ty);
  p.quadraticCurveTo(mx - nx, my - ny, x, y);
  p.closePath();
}

/** يرسم الجذع والأغصان والأوراق الأساسية مرة واحدة في ذاكرة مؤقتة */
export function paintTree(ctx: CanvasRenderingContext2D, tree: Tree, st: TreeState) {
  const pal = PAL[st.season], r = mulberry(7);
  ctx.save();
  // ظل الأرض
  const sh = ctx.createRadialGradient(500, 950, 10, 500, 950, st.season === 'summer' ? 430 : 330);
  sh.addColorStop(0, st.season === 'summer' ? 'rgba(52,48,30,.38)' : 'rgba(52,48,30,.22)'); sh.addColorStop(1, 'rgba(52,48,30,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(500, 950, 430, 46, 0, 0, Math.PI * 2); ctx.fill();
  // قماش القطاف في الخريف
  if (st.season === 'autumn') {
    ctx.fillStyle = 'rgba(226,214,186,.85)'; ctx.beginPath(); ctx.moveTo(250, 948); ctx.lineTo(760, 940); ctx.lineTo(820, 975); ctx.lineTo(200, 982); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3b2e3a';
    for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.ellipse(260 + r() * 520, 950 + r() * 26, 3.2, 2.4, r(), 0, Math.PI * 2); ctx.fill(); }
  }
  // الجذور
  ctx.fillStyle = pal.bark[2];
  for (const [dx, sp] of [[-1, 120], [-0.5, 70], [0.6, 90], [1, 130]] as const) {
    ctx.beginPath(); ctx.moveTo(500 + dx * 30, 900);
    ctx.quadraticCurveTo(500 + dx * sp * 0.7, 930, 500 + dx * sp, 948); ctx.lineTo(500 + dx * (sp - 30), 950);
    ctx.quadraticCurveTo(500 + dx * 20, 940, 500, 935); ctx.fill();
  }
  // الجذع: خيوط ملتوية متشابكة كجذوع الزيتون المعمّرة
  const strands = 7;
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < strands; k++) {
      const f = k / (strands - 1), bx = 430 + f * 140, tx = 470 + f * 60, tw = Math.sin(k * 1.7) * 46;
      ctx.beginPath(); ctx.moveTo(bx, 945);
      ctx.bezierCurveTo(bx + tw, 840, tx - tw * 0.9, 720, tx + tw * 0.25, 615);
      ctx.lineCap = 'round';
      ctx.strokeStyle = pass === 0 ? pal.bark[2] : pass === 1 ? pal.bark[k % 2] : 'rgba(255,245,225,.12)';
      ctx.lineWidth = pass === 0 ? 34 - f * 6 : pass === 1 ? 24 - f * 5 : 6;
      if (pass === 2) ctx.translate(-4, 0);
      ctx.stroke();
      if (pass === 2) ctx.translate(4, 0);
    }
  }
  // التجويف والعُقد
  ctx.fillStyle = 'rgba(30,24,20,.85)'; ctx.beginPath(); ctx.ellipse(503, 790, 15, 48, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pal.bark[3]; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(503, 790, 19, 53, 0.12, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 70; i++) { // أخاديد اللحاء
    const y = 640 + r() * 290, x = 455 + r() * 95 + Math.sin(y / 30) * 10;
    ctx.strokeStyle = 'rgba(25,20,16,.35)'; ctx.lineWidth = 1 + r() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 10, y + 14, x + (r() - 0.5) * 8, y + 26 + r() * 20); ctx.stroke();
  }
  // الأغصان: لون واحد متدرج العرض، وإضاءة خفيفة من الأعلى
  for (const s of [...tree.segs].sort((a, b) => a.depth - b.depth)) {
    const steps = s.depth < 2 ? 12 : 4;
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? (s.depth <= 0 ? pal.bark[0] : pal.bark[1]) : 'rgba(255,240,215,.16)';
      ctx.lineCap = 'round';
      for (let i = 0; i < steps; i++) {
        const a = bez(s, i / steps), b = bez(s, (i + 1) / steps), w = s.w0 + (s.w1 - s.w0) * (i / steps);
        ctx.lineWidth = pass === 0 ? w : Math.max(0.6, w * 0.3);
        ctx.beginPath(); ctx.moveTo(a.x, a.y - (pass ? w * 0.22 : 0)); ctx.lineTo(b.x, b.y - (pass ? w * 0.22 : 0)); ctx.stroke();
      }
    }
  }
  // كتلة الظل تحت الأوراق لإحساس العمق
  for (const t of tree.tips) {
    const g = ctx.createRadialGradient(t.x, t.y + 6, 2, t.x, t.y + 6, 46);
    g.addColorStop(0, 'rgba(45,58,32,.22)'); g.addColorStop(1, 'rgba(45,58,32,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x, t.y + 6, 46, 0, Math.PI * 2); ctx.fill();
  }
  // آلاف الأوراق الفضية المخضرة، مجمّعة حسب اللون
  const buckets = pal.leaves.map(() => new Path2D());
  for (const t of tree.tips) {
    for (let i = 0; i < 24; i++) {
      const d = r() * 40, a0 = r() * Math.PI * 2;
      const x = t.x + Math.cos(a0) * d, y = t.y + Math.sin(a0) * d * 0.75;
      leafPath(buckets[mod(i * 3 + (t.x | 0), buckets.length)], x, y, t.a + (r() - 0.5) * 2.4, 9 + r() * 6, 1.6 + r());
    }
  }
  for (const anchorList of tree.anchors) for (const an of anchorList) {
    for (let i = 0; i < 3; i++) leafPath(buckets[mod(i + (an.y | 0), buckets.length)], an.x, an.y, an.a + (i - 1) * 1.1 + (r() - 0.5) * 0.4, 9 + r() * 5, 1.5 + r() * 0.8);
  }
  buckets.forEach((p, i) => { ctx.fillStyle = pal.leaves[i]; ctx.fill(p); });
  // الأزهار: ربيعاً قليلة، وعند ألف ورقة تزهر الشجرة كلها
  const flowers = st.blooming ? 520 : st.season === 'spring' ? 140 : 0;
  ctx.fillStyle = '#f4f0dc';
  for (let i = 0; i < flowers; i++) { const t = tree.tips[i % tree.tips.length]; const x = t.x + (r() - 0.5) * 70, y = t.y + (r() - 0.5) * 50; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.57) * 2.2, y + Math.sin(k * 1.57) * 2.2, 1.5, 0, Math.PI * 2); ctx.fill(); } }
  // الزيتون: خريفاً ثمار القطاف، وعند خمسة آلاف ورقة زيتون ذهبي
  const olives = (st.season === 'autumn' ? 420 : 0) + (st.golden ? 460 : 0);
  for (let i = 0; i < olives; i++) {
    const golden = st.golden && i % 2 === 0, t = tree.tips[(i * 5) % tree.tips.length];
    const x = t.x + (r() - 0.5) * 66, y = t.y + (r() - 0.3) * 44;
    ctx.fillStyle = golden ? '#c9a043' : i % 3 ? '#3b2e3a' : '#6d7a3c';
    ctx.beginPath(); ctx.ellipse(x, y, 3.4, 4.6, r(), 0, Math.PI * 2); ctx.fill();
    if (golden) { ctx.fillStyle = 'rgba(255,240,190,.8)'; ctx.beginPath(); ctx.arc(x - 1, y - 1.5, 1.1, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/** خلفية جبال عجلون الفاتحة بطبقات وضباب */
export function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, season: Season) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const top = season === 'winter' ? '#dfe5ea' : '#e6ecee', mid = season === 'autumn' ? '#f3e7d2' : '#f4efe4';
  sky.addColorStop(0, top); sky.addColorStop(0.62, mid); sky.addColorStop(1, '#efe6d2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.2, 0, w * 0.78, h * 0.2, w * 0.4);
  sun.addColorStop(0, 'rgba(255,246,220,.9)'); sun.addColorStop(1, 'rgba(255,246,220,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  const layers = [
    { y: 0.5, amp: 0.05, col: '#cfd6cb', seed: 3 }, { y: 0.58, amp: 0.06, col: '#b9c4ae', seed: 5 },
    { y: 0.67, amp: 0.05, col: '#a4b08f', seed: 9 }, { y: 0.77, amp: 0.035, col: '#8f9b70', seed: 13 },
  ];
  layers.forEach((l, i) => {
    ctx.fillStyle = l.col; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 60) {
      const t = x / w;
      const y = h * l.y - h * l.amp * (Math.sin(t * 6.2 + l.seed) * 0.6 + Math.sin(t * 13.1 + l.seed * 2) * 0.3 + Math.sin(t * 2.3 + l.seed) * 0.7);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    // ضباب بين الطبقات
    const mist = ctx.createLinearGradient(0, h * (l.y - 0.02), 0, h * (l.y + 0.08));
    mist.addColorStop(0, 'rgba(247,242,232,0)'); mist.addColorStop(1, `rgba(247,242,232,${0.42 - i * 0.08})`);
    ctx.fillStyle = mist; ctx.fillRect(0, h * (l.y - 0.02), w, h * 0.1);
    // صنوبر وبلوط عجلون الصغير على السفوح القريبة
    if (i >= 2) {
      const rr = mulberry(l.seed * 101);
      ctx.fillStyle = i === 2 ? 'rgba(110,125,85,.55)' : 'rgba(92,108,70,.7)';
      for (let cl = 0; cl < 7; cl++) {
        const cx = rr() * w;
        for (let k = 0; k < 3 + Math.floor(rr() * 6); k++) {
          const x = cx + (rr() - 0.5) * w * 0.06, t = x / w;
          const y = h * l.y - h * l.amp * (Math.sin(t * 6.2 + l.seed) * 0.6 + Math.sin(t * 13.1 + l.seed * 2) * 0.3 + Math.sin(t * 2.3 + l.seed) * 0.7);
          ctx.beginPath(); ctx.ellipse(x, y - 2 + rr() * 6, 3 + rr() * 5, 4 + rr() * 6, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  });
  const ground = ctx.createLinearGradient(0, h * 0.82, 0, h);
  ground.addColorStop(0, '#c4bc8e'); ground.addColorStop(1, '#b3aa7a');
  ctx.fillStyle = ground; ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

/** يبني مسارات أوراق الزوار (مسار لكل محافظة) — 12 عملية تعبئة فقط لكل إطار */
export function visitorLeaves(tree: Tree, ids: string[], g: number[]) {
  const pos = new Float32Array(ids.length * 3); // x, y, angle
  ids.forEach((id, i) => {
    const list = tree.anchors[g[i]] ?? tree.anchors[0];
    const h = hash(id), an = list[h % list.length];
    const j = ((h >>> 8) % 1000) / 1000, k = ((h >>> 18) % 1000) / 1000;
    pos[i * 3] = an.x + (j - 0.5) * 14; pos[i * 3 + 1] = an.y + (k - 0.5) * 12; pos[i * 3 + 2] = an.a + (j - 0.5) * 2.6;
  });
  return pos;
}

export function leafPaths(pos: Float32Array, g: number[], keep: (i: number) => boolean) {
  const on = GOV_TONES.map(() => new Path2D()), off = new Path2D();
  for (let i = 0; i < g.length; i++) {
    const p = keep(i) ? (on[g[i]] ?? on[0]) : off;
    leafPath(p, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 21, 4.6);
  }
  return { on, off };
}

/** مسارات الأوراق مقسومة إلى أشرطة عمودية، لكل شريط طور ريح مختلف (موجة تعبر الشجرة) */
export const BANDS = 7;
export const bandOf = (x: number) => Math.min(BANDS - 1, Math.max(0, Math.floor((x / W) * BANDS)));
export function windPaths(pos: Float32Array, g: number[], keep: (i: number) => boolean) {
  const on = GOV_TONES.map(() => Array.from({ length: BANDS }, () => new Path2D()));
  const off = Array.from({ length: BANDS }, () => new Path2D());
  for (let i = 0; i < g.length; i++) {
    const b = bandOf(pos[i * 3]);
    const p = keep(i) ? (on[g[i]] ?? on[0])[b] : off[b];
    leafPath(p, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], 21, 4.6);
  }
  return { on, off };
}
/** إزاحة الريح لشريط في لحظة t (بالثواني): هبّات بطيئة فوق تمايل سريع خفيف */
export function wind(t: number, band: number) {
  const gust = 0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.33 + 1);
  const ph = band * 0.55;
  const dx = (Math.sin(t * 1.25 - ph) * 2.2 + Math.sin(t * 3.1 - ph * 1.7) * 0.7) * (0.6 + gust);
  return { dx, dy: Math.abs(dx) * 0.22, rot: dx * 0.004 };
}
