'use client';
import { useRef, useState } from 'react';
import { ZoomStage, type ZoomImage } from './ZoomStage';
import { play } from '@/lib/client/sound';
import s from './deepzoom.module.css';

/** زر «تكبير عميق» ولوحة ملء الشاشة */
export function DeepZoom({ img, title, children }: { img: ZoomImage; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const show = () => { ref.current?.showModal(); setOpen(true); play('pop'); };
  const close = () => { ref.current?.close(); };
  return (
    <>
      <button type="button" className={s.trigger} onClick={show} aria-haspopup="dialog" data-testid="deep-zoom">
        {children}
        <span className={s.badge}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" /></svg>تكبير عميق</span>
      </button>
      <dialog ref={ref} className="dialog" aria-label={`تكبير: ${title}`} onClose={() => setOpen(false)}>
        <div className={s.sheet}>
          <header className={s.bar}>
            <h2 className={s.title}>{title}</h2>
            <button type="button" className={s.close} onClick={close} aria-label="إغلاق">×</button>
          </header>
          {open && <ZoomStage img={img} label={title} className={s.stage} autoFocus />}
        </div>
      </dialog>
    </>
  );
}
