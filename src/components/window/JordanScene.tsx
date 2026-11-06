import s from './scene.module.css';

// مولّد حتمي حتى يتطابق رسم الخادم والمتصفح
function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const r = rng(46);
const stars = Array.from({ length: 140 }, (_, i) => ({
  x: Math.round(r() * 1600), y: Math.round(r() * 520), rad: +(r() * 1.3 + 0.45).toFixed(2), tw: i % 6 === 0,
}));
// خطوط التعرية العمودية على جبال وادي رم
const flutes = (x0: number, x1: number, top: (x: number) => number, base: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = x0 + ((i + 0.5) / n) * (x1 - x0) + (r() - 0.5) * 22;
    const y0 = top(x) + 40 + r() * 90;
    const y1 = Math.min(base, y0 + 90 + r() * 170);
    const bend = (r() - 0.5) * 18;
    return `M${x.toFixed(1)},${y0.toFixed(1)} Q${(x + bend).toFixed(1)},${((y0 + y1) / 2).toFixed(1)} ${(x + bend * 0.4).toFixed(1)},${y1.toFixed(1)}`;
  }).join(' ');
const leftTop = (x: number) => 420 - Math.sin(((x - 360) / 420) * Math.PI) * 60;
const rightTop = (x: number) => 380 - Math.sin(((x - 880) / 460) * Math.PI) * 70;
const leftFlutes = flutes(400, 760, leftTop, 690, 9);
const rightFlutes = flutes(900, 1330, rightTop, 690, 10);
function OliveDefs() {
  return (
    <symbol id="olive-tree" viewBox="-110 -200 220 205" overflow="visible">
      <path className={s.trunk} d="M-10,0 C-16,-24 -2,-38 -16,-60 C-26,-78 -10,-92 -6,-110 L6,-110 C10,-94 24,-80 14,-60 C6,-42 18,-24 12,0 Z" />
      <path className={s.trunk} d="M-8,-84 C-32,-98 -50,-114 -64,-124 L-59,-129 C-42,-121 -24,-108 -4,-98 Z" />
      <path className={s.trunk} d="M8,-88 C30,-102 46,-116 62,-130 L67,-125 C54,-111 38,-96 12,-80 Z" />
      <path className={s.trunkLit} d="M2,-4 C6,-26 -2,-44 6,-62 C12,-76 4,-92 4,-108 L6,-110 C10,-94 24,-80 14,-60 C6,-42 18,-24 12,0 Z" />
      {/* تاج الزيتون: عناقيد مستديرة كثيفة بلون فضي مخضر */}
      <g className={s.canopy}>
        {[[-70, -128, 34, 28], [-34, -158, 40, 34], [16, -168, 42, 34], [58, -146, 38, 30], [90, -120, 26, 22],
          [-92, -104, 24, 20], [-12, -124, 46, 30], [40, -112, 36, 24], [-56, -150, 30, 26], [74, -98, 22, 16]]
          .map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />)}
      </g>
      <g className={s.canopyLit}>
        {[[-38, -182, 22, 12], [20, -192, 24, 12], [62, -168, 18, 10], [-80, -148, 16, 9], [-8, -146, 20, 9]]
          .map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />)}
      </g>
    </symbol>
  );
}

/** مشهد طبيعة الأردن خلف القوس، مؤلَّف حول منتصفه (x≈800):
 *  جبلا وادي رم وبينهما فجوة تغيب فيها الشمس، وسهل رملي، ومدرّجات وزيتونة عجلون في المقدمة.
 *  الألوان متغيرات CSS تتبدل حسب html[data-phase]. */
export function JordanScene({ className = '' }: { className?: string }) {
  return (
    <svg className={`${s.scene} ${s.vars} ${className}`} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.skyTop} />
          <stop offset="0.5" className={s.skyMid} />
          <stop offset="0.7" className={s.skyHorizon} />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" className={s.glowCore} />
          <stop offset="0.35" className={s.glowMid} />
          <stop offset="1" className={s.glowEdge} />
        </radialGradient>
        <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.rockLit} />
          <stop offset="0.55" className={s.rock} />
          <stop offset="1" className={s.rockShade} />
        </linearGradient>
        <linearGradient id="rockSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className={s.rockShade} stopOpacity="0.55" />
          <stop offset="0.6" className={s.rockShade} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rockSideR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" className={s.rockShade} stopOpacity="0.55" />
          <stop offset="0.6" className={s.rockShade} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.farTop} />
          <stop offset="1" className={s.farBase} />
        </linearGradient>
        <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.sandFar} />
          <stop offset="1" className={s.sandNear} />
        </linearGradient>
        <linearGradient id="hillG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.hillTop} />
          <stop offset="1" className={s.hillBase} />
        </linearGradient>
        <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={s.hazeStop} stopOpacity="0" />
          <stop offset="0.55" className={s.hazeStop} />
          <stop offset="1" className={s.hazeStop} stopOpacity="0" />
        </linearGradient>
        <mask id="crescent">
          <circle cx="0" cy="0" r="34" fill="#fff" />
          <circle cx="13" cy="-7" r="30" fill="#000" />
        </mask>
        <OliveDefs />
      </defs>

      <rect width="1600" height="1000" fill="url(#sky)" />

      <g className={s.stars}>
        {stars.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.rad} className={st.tw ? s.twinkle : undefined}
            style={st.tw ? { animationDelay: `${(i % 5) * 0.7}s` } : undefined} />
        ))}
      </g>

      {/* الشمس والقمر */}
      <g className={s.sun}>
        <circle r="300" fill="url(#sunGlow)" />
        <circle r="46" className={s.sunDisc} />
      </g>
      <g className={s.moon}>
        <circle r="150" fill="url(#sunGlow)" />
        <circle r="34" className={s.moonDisc} mask="url(#crescent)" />
      </g>

      {/* هضبة مؤاب البعيدة */}
      <path fill="url(#far)" d="M0,612 C140,600 260,606 380,594 C520,580 640,598 780,590 C900,583 1020,596 1160,586 C1300,576 1460,592 1600,584 V720 H0 Z" />
      <rect y="500" width="1600" height="230" fill="url(#haze)" className={s.hazeRect} />

      {/* جبلا وادي رم */}
      <path fill="url(#rock)" d="M300,700 C320,640 330,560 352,500 C364,462 392,440 420,424 C470,368 560,352 640,372 C700,384 744,420 762,470 C780,520 786,600 800,700 Z" />
      <path fill="url(#rockSide)" d="M300,700 C320,640 330,560 352,500 C364,462 392,440 420,424 C440,500 430,600 440,700 Z" />
      <path className={s.flute} d={leftFlutes} />
      <path fill="url(#rock)" d="M860,700 C872,620 878,520 900,450 C914,404 944,372 984,352 C1040,300 1150,290 1230,318 C1290,338 1330,384 1346,440 C1366,510 1370,610 1400,700 Z" />
      <path fill="url(#rockSideR)" d="M1400,700 C1370,610 1366,510 1346,440 C1330,384 1290,338 1250,326 C1290,420 1300,560 1320,700 Z" />
      <path className={s.flute} d={rightFlutes} />
      {/* جبل منخفض بعيد في الفجوة */}
      <path className={s.butte} d="M760,700 C772,664 790,640 820,636 C846,632 866,646 874,700 Z" />

      {/* السهل الرملي وكثبانه */}
      <path fill="url(#sand)" d="M0,700 C220,676 420,694 640,684 C860,672 1080,694 1300,680 C1440,672 1540,676 1600,672 V1000 H0 Z" />
      <path className={s.dune} d="M120,770 C300,730 520,742 700,760 C820,772 900,770 980,756 C1120,732 1320,736 1520,762 L1600,770 V800 H0 Z" />
      <path className={s.dune} d="M0,808 C240,782 470,790 660,804 C760,812 860,806 960,796 C1180,776 1400,786 1600,800 V840 H0 Z" opacity=".7" />
      <path className={s.duneLit} d="M700,760 C820,772 900,770 980,756 C1060,742 1160,736 1260,740 C1150,752 1060,770 980,778 C890,788 800,784 700,760 Z" />

      {/* مدرّجات عجلون وزيتونها في المقدمة */}
      <path fill="url(#hillG)" d="M0,836 C170,806 360,812 560,836 C660,850 720,900 760,1000 H0 Z" />
      <path fill="url(#hillG)" d="M1600,864 C1430,840 1230,850 1040,884 C960,900 900,940 870,1000 H1600 Z" />
      <path fill="url(#hillG)" d="M560,1000 C660,948 820,936 980,952 C1040,960 1080,980 1100,1000 Z" />
      <path className={s.terrace} d="M0,872 C170,846 360,850 600,872 M0,912 C180,888 380,892 650,914 M0,952 C200,930 420,934 700,958" />
      <path className={s.terrace} d="M1600,896 C1430,874 1240,882 1020,914 M1600,936 C1420,916 1220,924 960,962" />
      <use href="#olive-tree" x="-110" y="-200" width="220" height="205" transform="translate(1035 892) scale(1.3)" />
      <use href="#olive-tree" x="-110" y="-200" width="220" height="205" transform="translate(1380 868) scale(1)" />
      <use href="#olive-tree" x="-110" y="-200" width="220" height="205" transform="translate(610 852) scale(0.78)" />
      <use href="#olive-tree" x="-110" y="-200" width="220" height="205" transform="translate(250 836) scale(1.1)" />
    </svg>
  );
}
