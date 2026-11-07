'use client';
import { useEffect } from 'react';

/** يضبط تقدم التمرير (--p) على الهيرو ليكبر القوس ويعبر الزائر منه. لا يرسم شيئاً. */
export function HeroController({ targetId }: { targetId: string }) {
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
  return null;
}
