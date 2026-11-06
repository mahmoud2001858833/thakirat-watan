'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import s from './hero.module.css';

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
const labels: Record<Phase, string> = { dawn: 'فجر', day: 'ظهيرة', dusk: 'غروب', night: 'ليل' };
const order: Phase[] = ['dawn', 'day', 'dusk', 'night'];

export function ammanPhase(d = new Date()): Phase {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Amman' }).format(d));
  return h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night';
}

// ساعة عمّان — تتحدث كل دقيقة
const subscribeClock = (fn: () => void) => { const t = setInterval(fn, 30_000); return () => clearInterval(t); };
const clockText = () => new Intl.DateTimeFormat('ar-JO-u-nu-arab', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Amman' }).format(new Date());

/** يضبط تقدم التمرير (--p) على الهيرو، ويعرض ساعة عمّان وأزرار معاينة الأوقات */
export function HeroController({ targetId }: { targetId: string }) {
  const clock = useSyncExternalStore(subscribeClock, clockText, () => '');
  const live = useRef<Phase | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);

  useEffect(() => {
    const p = (document.documentElement.dataset.phase as Phase) || ammanPhase();
    live.current = ammanPhase();
    setPhase(p); // eslint-disable-line react-hooks/set-state-in-effect -- مزامنة مع سمة ضبطها سكربت ما قبل الرسم
    const t = setInterval(() => {
      live.current = ammanPhase();
      if (!manualRef.current) setPhase(live.current);
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { manualRef.current = manual; }, [manual]);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, visible = true;
    const update = () => {
      raf = 0;
      const total = el.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(total, 1)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => { if (visible && !raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll(); });
    io.observe(el);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
    return () => { io.disconnect(); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [targetId]);

  // الحالة هي المرجع؛ السمة على <html> تتبعها (يقرؤها المشهد عبر CSS)
  useEffect(() => { if (phase) document.documentElement.dataset.phase = phase; }, [phase]);

  const choose = (p: Phase) => {
    setPhase(p);
    setManual(p !== live.current);
  };

  return (
    <div className={s.meta}>
      <p className={s.clock} aria-live="polite">
        <span>عمّان</span>
        {clock && <span className={s.time}>{clock}</span>}
        {phase && <span>· {manual ? `معاينة ${labels[phase]}` : labels[phase]}</span>}
      </p>
      <div className={s.phases} role="group" aria-label="شاهد ضوء الأردن في أوقات النهار">
        {order.map((p) => (
          <button key={p} type="button" className={s.phaseBtn} aria-pressed={phase === p} onClick={() => choose(p)} data-phase-btn={p}>
            <span className={s.dot} data-p={p} aria-hidden="true" />
            {labels[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
