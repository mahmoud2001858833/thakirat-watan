'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { play } from '@/lib/client/sound';
import type { Activity, Results, Session } from '@/lib/live';
import { ResultsView } from './ResultsView';
import s from './live.module.css';

const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
const empty: Results = { votes: [], pins: [], texts: [], answered: 0, class_size: 0 };
type Pending = { id: string; body: string; shown: boolean; member_id: string };

/** شاشة الصف ولوحة المعلم: النتائج تصل لحظياً، والنصوص لا تظهر للصف قبل موافقة المعلم */
export function LiveConsole({ session, activities, classSize }: { session: Session; activities: Activity[]; classSize: number }) {
  const sb = browserClient();
  const [ses, setSes] = useState(session);
  const [res, setRes] = useState<Results>(empty);
  const [texts, setTexts] = useState<Pending[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [screen, setScreen] = useState(false);
  const [live, setLive] = useState(false);
  const act = activities.find((a) => a.idx === ses.current) ?? activities[0];
  const timer = useRef(0);

  const refresh = useCallback(async () => {
    if (!act) return;
    const [{ data: r }, { data: t }] = await Promise.all([
      sb.rpc('live_results', { p_activity: act.id }),
      act.kind === 'text' ? sb.from('live_responses').select('id, body, shown, member_id').eq('activity_id', act.id).order('created_at') : Promise.resolve({ data: [] }),
    ]);
    if (r) setRes(r as Results);
    setTexts((t ?? []) as Pending[]);
  }, [act, sb]);

  useEffect(() => { refresh(); }, [refresh]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    sb.rpc('my_classmates', { p_class: ses.class_id }).then(({ data }: { data: { member_id: string; pseudonym: string }[] | null }) =>
      setNames(Object.fromEntries((data ?? []).map((m) => [m.member_id, m.pseudonym]))));
  }, [sb, ses.class_id]);

  // كل إجابة جديدة تصل لحظياً
  useEffect(() => {
    const ch = sb.channel(`live-console:${ses.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_responses', filter: `session_id=eq.${ses.id}` }, () => {
        clearTimeout(timer.current); timer.current = window.setTimeout(() => { refresh(); play('pop'); }, 150);
      })
      .subscribe((st: string) => setLive(st === 'SUBSCRIBED'));
    return () => { sb.removeChannel(ch); };
  }, [sb, ses.id, refresh]);

  const update = async (p: Partial<Pick<Session, 'current' | 'reveal' | 'status'>>) => {
    setSes((x) => ({ ...x, ...p }));
    await sb.from('live_sessions').update({ ...p, ...(p.status === 'ended' ? { ended_at: new Date().toISOString() } : {}) }).eq('id', ses.id);
    play('tap');
  };
  const show = async (id: string, shown: boolean) => {
    setTexts((t) => t.map((x) => (x.id === id ? { ...x, shown } : x)));
    await sb.from('live_responses').update({ shown }).eq('id', id);
    refresh();
  };
  const go = (d: number) => {
    const n = Math.min(activities.length - 1, Math.max(0, ses.current + d));
    if (n !== ses.current) update({ current: n, reveal: false });
  };

  const toggleScreen = () => {
    const next = !screen; setScreen(next);
    try { if (next) document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1);
      if (e.key === 'r') update({ reveal: !ses.reveal });
      if (e.key === 'f') toggleScreen();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  if (!act) return <main className={s.page}><p>لا أسئلة في هذه الجلسة.</p></main>;
  const host = typeof location !== 'undefined' ? location.host : 'thakirat-watan.vercel.app';
  return (
    <main className={`${s.page} ${screen ? s.screen : ''}`} data-testid="live-console">
      <header className={s.bar}>
        <div className={s.join}>
          <span className={s.joinLabel}>ادخلوا من {host}/join</span>
          <span className={s.joinCode} data-testid="live-code" dir="ltr">{ses.code.slice(0, 3)} {ses.code.slice(3)}</span>
        </div>
        <div className={s.meta}>
          <span className={s.count} data-testid="answered">{ar(res.answered)} / {ar(classSize)} أجابوا</span>
          <span className={`${s.liveDot} ${live ? s.on : ''}`} aria-label={live ? 'متصل مباشرة' : 'يتصل…'} />
        </div>
      </header>

      <section className={s.stage} aria-live="polite">
        <p className={s.step}>السؤال {ar(ses.current + 1)} من {ar(activities.length)}</p>
        <h1 className={s.prompt}>{act.prompt}</h1>
        <ResultsView act={act} res={res} reveal={ses.reveal || act.kind === 'pin'} big />
      </section>

      {!screen && act.kind === 'text' && (
        <section className={s.moderate} aria-labelledby="mod-h">
          <h2 id="mod-h">الإجابات قبل العرض <span className={s.hint}>لا يراها الصف حتى تضغط «اعرض»</span></h2>
          {!texts.length ? <p className={s.hint}>لم تصل إجابات بعد.</p> : (
            <ul className={s.modList} data-testid="moderation">
              {texts.map((t) => (
                <li key={t.id}>
                  <span><strong>{names[t.member_id] ?? 'طالب'}:</strong> {t.body}</span>
                  <button type="button" className={`btn ${t.shown ? '' : 'btn-primary'}`} onClick={() => show(t.id, !t.shown)} data-testid="show-text">{t.shown ? 'أخفِ' : 'اعرض'}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className={s.controls}>
        <button type="button" className="btn" onClick={() => go(-1)} disabled={ses.current === 0}>→ السابق</button>
        {act.kind !== 'pin' && <button type="button" className="btn" onClick={() => update({ reveal: !ses.reveal })} data-testid="reveal">{ses.reveal ? 'أخفِ النتائج' : 'اكشف النتائج'}</button>}
        <button type="button" className="btn btn-primary" onClick={() => go(1)} disabled={ses.current >= activities.length - 1} data-testid="next-act">التالي ←</button>
        <button type="button" className="btn btn-quiet" onClick={toggleScreen}>{screen ? 'لوحة المعلم' : 'شاشة الصف'}</button>
        {ses.status === 'open'
          ? <button type="button" className="btn btn-quiet" onClick={() => { if (confirm('إنهاء الجلسة؟')) update({ status: 'ended' }); }}>أنهِ الجلسة</button>
          : <Link href={`/teach/${ses.class_id}`} className="btn btn-quiet">انتهت · عُد إلى الصف</Link>}
      </footer>
    </main>
  );
}
