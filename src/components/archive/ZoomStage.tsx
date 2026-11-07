'use client';
import { useEffect, useState } from 'react';
import { usePanZoom, type View } from './usePanZoom';
import s from './zoom.module.css';

export type ZoomImage = { src: string; hires: string | null; w: number; h: number; alt: string; blur?: string | null };

/** مسرح التكبير: الصورة المحلية أولاً، ثم الدقة العالية حين تصل */
export function ZoomStage({ img, label, onView, sync, className = '', autoFocus = false, light = false }:
  { img: ZoomImage; label: string; onView?: (v: View) => void; sync?: View | null; className?: string; autoFocus?: boolean; light?: boolean }) {
  const { boxRef, style, ratio, zoomAt, reset, set, onKeyDown } = usePanZoom({ w: img.w, h: img.h }, { max: 10, onChange: onView });
  const [hiOk, setHiOk] = useState(false);
  const [wantHi, setWantHi] = useState(false);
  useEffect(() => { if (sync) set(sync); }, [sync, set]);
  // نطلب الدقة العالية حين يبدأ الزائر بالتكبير فقط، حفاظاً على الإنترنت الضعيف
  useEffect(() => { if (ratio > 1.3 && img.hires) setWantHi(true); }, [ratio, img.hires]); // eslint-disable-line react-hooks/set-state-in-effect
  const pct = Math.round(ratio * 100);
  return (
    <div className={`${s.stageWrap} ${light ? s.light : ''} ${className}`}>
      <div ref={boxRef} className={s.stage} tabIndex={0} role="img" aria-label={`${label}. اسحب للتحريك، والعجلة أو القرص أو + و- للتكبير، و0 للعودة.`}
        onKeyDown={onKeyDown} autoFocus={autoFocus} data-testid="zoom-stage">
        <div className={s.layer} style={style} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- التكبير يحتاج الصورة الأصلية بلا تحسين */}
          <img src={img.src} alt="" className={s.img} draggable={false} style={img.blur ? { backgroundImage: `url(${img.blur})` } : undefined} />
          {wantHi && img.hires && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.hires} alt="" className={`${s.img} ${s.hi}`} data-ready={hiOk} draggable={false} onLoad={() => setHiOk(true)} referrerPolicy="no-referrer" />
          )}
        </div>
      </div>
      <div className={s.tools} role="group" aria-label="أدوات التكبير">
        <button type="button" className={s.tool} onClick={() => zoomAt(1 / 1.6)} aria-label="تصغير" disabled={ratio <= 1}>−</button>
        <span className={s.pct} aria-live="polite" data-testid="zoom-pct">{new Intl.NumberFormat('ar-JO-u-nu-arab').format(pct)}٪</span>
        <button type="button" className={s.tool} onClick={() => zoomAt(1.6)} aria-label="تكبير">+</button>
        <button type="button" className={s.tool} onClick={reset} aria-label="ملء الإطار" disabled={ratio <= 1}>⤢</button>
        {wantHi && <span className={s.hiNote}>{hiOk ? 'الدقة العالية' : 'تحميل الدقة العالية…'}</span>}
      </div>
    </div>
  );
}
