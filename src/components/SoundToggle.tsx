'use client';
import { useSyncExternalStore } from 'react';
import { isMuted, setMuted, subscribeMuted, play } from '@/lib/client/sound';

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  return (
    <button type="button" className="icon-btn" aria-pressed={!muted} aria-label={muted ? 'تشغيل الأصوات' : 'كتم الأصوات'} title={muted ? 'الأصوات مكتومة' : 'الأصوات تعمل'}
      onClick={() => { setMuted(!muted); if (muted) play('pop'); }}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity=".12" />
        {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></>}
      </svg>
    </button>
  );
}
