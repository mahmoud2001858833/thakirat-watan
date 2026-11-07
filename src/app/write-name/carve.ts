// رسم الحجر المنقوش على Canvas: ملمس الحجر، والحروف المحفورة بظل وضوء يتبعان مصدر الضوء، والإزميل والغبار.

export type Material = 'basalt' | 'sandstone' | 'stele';
export type Glyph = { ch: string; x: number; y: number; w: number; top: number; h: number };
export type Layout = { glyphs: Glyph[]; size: number };
export type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number };

const MAT: Record<Material, { base: [number, number, number]; spread: number; cut: string; shade: string; lit: string; speck: number; bands: boolean }> = {
  basalt: { base: [74, 69, 64], spread: 26, cut: 'rgba(10,8,7,0.78)', shade: 'rgba(0,0,0,0.85)', lit: 'rgba(255,244,226,0.42)', speck: 0.06, bands: false },
  sandstone: { base: [196, 140, 112], spread: 22, cut: 'rgba(80,36,22,0.62)', shade: 'rgba(50,20,10,0.78)', lit: 'rgba(255,236,214,0.6)', speck: 0.02, bands: true },
  stele: { base: [62, 64, 68], spread: 20, cut: 'rgba(6,6,8,0.78)', shade: 'rgba(0,0,0,0.85)', lit: 'rgba(236,240,248,0.4)', speck: 0.04, bands: false },
};

/** ملمس الحجر مرة واحدة لكل مادة وحجم: ضوضاء متعددة الطبقات، وطبقات رملية للحجر الرملي، وحبيبات */
export function stoneTexture(mat: Material, W: number, H: number) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const m = MAT[mat];
  // ضوضاء قيمية بسيطة بشبكات متعددة
  const S = 64, grid = (n: number) => Float32Array.from({ length: (n + 1) * (n + 1) }, () => Math.random());
  const octs = [4, 9, 20, 48, 110].map((n) => ({ n, v: grid(n) }));
  const sample = (o: { n: number; v: Float32Array }, u: number, v: number) => {
    const x = u * o.n, y = v * o.n, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const at = (i: number, j: number) => o.v[Math.min(o.n, j) * (o.n + 1) + Math.min(o.n, i)];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
  };
  // نرسم بدقة أقل ثم نكبّر (أسرع)، ثم نضيف حبيبات بالدقة الكاملة
  const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  const small = document.createElement('canvas'); small.width = w; small.height = h;
  const sg = small.getContext('2d')!; const img = sg.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let n = 0, amp = 1, tot = 0;
    for (const o of octs) { n += sample(o, u, v) * amp; tot += amp; amp *= 0.5; }
    n = n / tot - 0.5;
    let band = 0;
    if (m.bands) band = Math.sin((v * 7 + sample(octs[0], u, v) * 2.2) * Math.PI) * 0.22 + Math.sin(v * 37 + u * 3) * 0.06;
    const k = n * m.spread * 2 + band * m.spread;
    const i = (y * w + x) * 4;
    img.data[i] = m.base[0] + k + (m.bands ? band * 18 : 0);
    img.data[i + 1] = m.base[1] + k * 0.92;
    img.data[i + 2] = m.base[2] + k * 0.85 - (m.bands ? band * 8 : 0);
    img.data[i + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, W, H);
  // حبيبات ونقر صغيرة
  const count = Math.floor(W * H * m.speck / 40);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.6 + 0.3;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // حواف داكنة كأن الحجر قطعة مستقلة
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  void S;
  return c;
}

/** توزيع الحروف على أسطر من اليمين إلى اليسار، بأكبر حجم يتسع */
export function layout(g: CanvasRenderingContext2D, text: string, font: string, W: number, H: number): Layout {
  const words = text.split(' ').filter(Boolean);
  const pad = W * 0.1;
  for (let size = Math.floor(Math.min(W * 0.26, H * 0.3)); size >= 18; size -= 4) {
    g.font = `${size}px ${font}`;
    const space = g.measureText(' ').width * 1.4 || size * 0.35;
    const lines: { chars: { ch: string; w: number }[]; width: number }[] = [];
    let cur: { chars: { ch: string; w: number }[]; width: number } = { chars: [], width: 0 };
    let fits = true;
    for (const wd of words) {
      const chars = [...wd].map((ch) => ({ ch, w: g.measureText(ch).width + size * 0.06 }));
      const ww = chars.reduce((a, c) => a + c.w, 0);
      if (ww > W - pad * 2) { fits = false; break; }
      const add = (cur.chars.length ? space : 0) + ww;
      if (cur.width + add > W - pad * 2 && cur.chars.length) { lines.push(cur); cur = { chars: [], width: 0 }; }
      if (cur.chars.length) cur.chars.push({ ch: ' ', w: space });
      cur.chars.push(...chars); cur.width = cur.chars.reduce((a, c) => a + c.w, 0);
    }
    if (!fits) continue;
    if (cur.chars.length) lines.push(cur);
    const lh = size * 1.45, total = lines.length * lh;
    if (total > H - pad * 2) continue;
    const glyphs: Glyph[] = [];
    lines.forEach((ln, li) => {
      let x = (W + ln.width) / 2; // نبدأ من اليمين
      const y = (H - total) / 2 + li * lh + lh * 0.62;
      for (const c of ln.chars) {
        x -= c.w;
        if (c.ch !== ' ') glyphs.push({ ch: c.ch, x: x + size * 0.03, y, w: c.w, top: y - size * 0.95, h: size * 1.25 });
      }
    });
    return { glyphs, size };
  }
  return { glyphs: [], size: 18 };
}

/** يرسم إطاراً كاملاً. progress[i] بين 0 و1 لكل حرف. light موضع الضوء بإحداثيات اللوحة. */
export function drawFrame(g: CanvasRenderingContext2D, o: {
  W: number; H: number; tex: HTMLCanvasElement; mat: Material; font: string; lay: Layout; progress: number[];
  light: { x: number; y: number }; dust: Dust[]; chisel: { x: number; y: number; hit: number } | null; shake: number; scratch: [HTMLCanvasElement, HTMLCanvasElement];
}) {
  const { W, H, mat, lay, light } = o; const m = MAT[mat];
  g.save();
  if (o.shake) g.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
  g.drawImage(o.tex, 0, 0, W, H);

  // الضوء على سطح الحجر
  const R = Math.max(W, H) * 1.1;
  const lg = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, R);
  lg.addColorStop(0, 'rgba(255,240,215,0.32)'); lg.addColorStop(0.35, 'rgba(255,240,215,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  const glow = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, R * 0.6);
  glow.addColorStop(0, 'rgba(255,236,200,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0.0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  // اتجاه الضوء لكل حرف: الجدار الداخلي القريب من الضوء في الظل، والبعيد مضاء
  const d = Math.max(2, lay.size * 0.06);
  const bold = lay.size * 0.07;
  const put = (c: CanvasRenderingContext2D, ch: string, x: number, y: number) => {
    c.fillText(ch, x, y); c.lineWidth = bold; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle; c.strokeText(ch, x, y);
  };
  const [sh, li] = o.scratch;
  const sg = sh.getContext('2d')!, lgx = li.getContext('2d')!;
  sg.clearRect(0, 0, W, H); lgx.clearRect(0, 0, W, H);
  g.font = sg.font = lgx.font = `${lay.size}px ${o.font}`;
  g.textBaseline = sg.textBaseline = lgx.textBaseline = 'alphabetic';
  lay.glyphs.forEach((gl, i) => {
    const p = o.progress[i] ?? 0; if (p <= 0) return;
    let dx = light.x - (gl.x + gl.w / 2), dy = light.y - (gl.y - lay.size * 0.35);
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const clip = (c: CanvasRenderingContext2D) => { c.save(); c.beginPath(); c.rect(gl.x - lay.size * 0.2, gl.top, gl.w + lay.size * 0.4, gl.h * p); c.clip(); };
    // قاع الحفر
    clip(g); g.fillStyle = m.cut; put(g, gl.ch, gl.x, gl.y); g.restore();
    // الظل: الحرف ناقص نفسه مزاحاً نحو الضوء
    clip(sg); sg.globalCompositeOperation = 'source-over'; sg.fillStyle = m.shade; put(sg, gl.ch, gl.x, gl.y);
    sg.globalCompositeOperation = 'destination-out'; sg.fillStyle = '#000'; put(sg, gl.ch, gl.x - dx * d, gl.y - dy * d); sg.restore();
    // الضوء: الحرف ناقص نفسه مزاحاً بعيداً عن الضوء
    clip(lgx); lgx.globalCompositeOperation = 'source-over'; lgx.fillStyle = m.lit; put(lgx, gl.ch, gl.x, gl.y);
    lgx.globalCompositeOperation = 'destination-out'; lgx.fillStyle = '#000'; put(lgx, gl.ch, gl.x + dx * d * 0.45, gl.y + dy * d * 0.45); lgx.restore();
  });
  sg.globalCompositeOperation = lgx.globalCompositeOperation = 'source-over';
  g.drawImage(sh, 0, 0); g.drawImage(li, 0, 0);

  // الغبار
  for (const p of o.dust) {
    g.fillStyle = mat === 'sandstone' ? `rgba(240,206,180,${p.life * 0.8})` : `rgba(214,206,196,${p.life * 0.7})`;
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
  }
  // الإزميل
  if (o.chisel) drawChisel(g, o.chisel.x, o.chisel.y, lay.size, o.chisel.hit);
  g.restore();
}

function drawChisel(g: CanvasRenderingContext2D, x: number, y: number, size: number, hit: number) {
  const L = size * 1.3, w = Math.max(4, size * 0.08);
  g.save();
  g.translate(x, y - hit * size * 0.08);
  g.rotate(-0.62);
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 12; g.shadowOffsetY = 6;
  // النصل المعدني
  const mg = g.createLinearGradient(-w, 0, w, 0);
  mg.addColorStop(0, '#6f737a'); mg.addColorStop(0.5, '#e4e7ec'); mg.addColorStop(1, '#5d6168');
  g.fillStyle = mg;
  g.beginPath(); g.moveTo(-w * 0.5, 0); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.7, -L * 0.45); g.lineTo(-w * 0.7, -L * 0.45); g.closePath(); g.fill();
  // المقبض الخشبي
  const wg = g.createLinearGradient(-w, 0, w, 0);
  wg.addColorStop(0, '#6b4424'); wg.addColorStop(0.5, '#b07a45'); wg.addColorStop(1, '#5a381c');
  g.fillStyle = wg;
  g.beginPath(); g.roundRect(-w * 1.05, -L, w * 2.1, L * 0.58, w * 0.6); g.fill();
  g.restore();
}

export const spawnDust = (x: number, y: number, size: number): Dust[] =>
  Array.from({ length: 6 + Math.floor(Math.random() * 6) }, () => ({
    x: x + (Math.random() - 0.5) * size * 0.2, y, vx: (Math.random() - 0.5) * size * 0.05, vy: -Math.random() * size * 0.05,
    life: 1, r: Math.random() * size * 0.018 + 0.8,
  }));
