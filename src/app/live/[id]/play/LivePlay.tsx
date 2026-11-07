'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase/browser';
import { play, buzz } from '@/lib/client/sound';
import type { Activity, Results, Session } from '@/lib/live';
import { ResultsView } from '../ResultsView';
import s from '../live.module.css';

const empty: Results = { votes: [], pins: [], texts: [], answered: 0, class_size: 0 };

/** هاتف الطالب: يتبع سؤال المعلم لحظياً، ويجيب، ويرى النتائج حين يكشفها المعلم */
export function LivePlay({ session, activities, me }: { session: Session; activities: Activity[]; me: string }) {
  const sb = browserClient();
  const [ses, setSes] = useState(session);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [pins, setPins] = useState<[number, number][]>([]);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Results>(empty);
  const act = activities.find((a) => a.idx === ses.current);

  useEffect(() => {
    const ch = sb.channel(`live-play:${ses.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${ses.id}` }, (p: { new: Session }) => {
        setSes((old) => { if (old.current !== p.new.current) { play('pop'); buzz(15); } return { ...old, ...p.new }; });
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, ses.id]);
  // سؤال جديد: نبدأ من الصفر
  useEffect(() => { setChoice(null); setText(''); setPins([]); setSent(false); setErr(null); }, [ses.current]); // eslint-disable-line react-hooks/set-state-in-effect

  const loadResults = useCallback(async () => {
    if (!act || !ses.reveal) return;
    const { data } = await sb.rpc('live_results', { p_activity: act.id });
    if (data) setRes(data as Results);
  }, [act, ses.reveal, sb]);
  useEffect(() => { loadResults(); }, [loadResults]); // eslint-disable-line react-hooks/set-state-in-effect

  const send = async (args: { p_choice?: number; p_body?: string; p_x?: number; p_y?: number }) => {
    if (!act) return;
    setErr(null);
    const { error } = await sb.rpc('live_respond', { p_activity: act.id, p_choice: null, p_body: null, p_x: null, p_y: null, ...args });
    if (error) { setErr('لم يصل جوابك. ربما انتقل المعلم إلى سؤال آخر.'); play('error'); return false; }
    setSent(true); play('snap'); buzz(12); return true;
  };

  if (ses.status === 'ended') return <main className={s.phone}><p className={s.wait}>انتهت الجلسة. شكراً لك، {me}.</p><Link href="/class" className="btn">صفي</Link></main>;
  if (!act) return <main className={s.phone}><p className={s.wait}>انتظر سؤال المعلم…</p></main>;
  return (
    <main className={s.phone} data-testid="live-play">
      <p className={s.step}>{ses.title} · أنت «{me}»</p>
      <h1 className={s.prompt} style={{ fontSize: 'var(--step-2)' }}>{act.prompt}</h1>
      {act.kind === 'pin' && <p className={s.hint}>المس الصورة لتضع إشارة (حتى ثلاث).</p>}
      {act.kind === 'poll' && !ses.reveal && act.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={act.image} alt="صورة الجلسة من الأرشيف" style={{ width: '100%', borderRadius: 16 }} />
      )}
      {act.kind === 'pin' && (
        <ResultsView act={act} res={res} reveal={false} mine={pins} onPin={async (x, y) => {
          const next = [...pins, [x, y] as [number, number]].slice(-3); setPins(next); await send({ p_x: x, p_y: y });
        }} />
      )}
      {act.kind === 'poll' && (
        <div className={s.choices} role="group" aria-label="الخيارات">
          {act.options.map((o, i) => (
            <button key={i} type="button" className={s.choice} aria-pressed={choice === i} data-testid="live-choice"
              onClick={async () => { setChoice(i); await send({ p_choice: i }); }}>{o}</button>
          ))}
        </div>
      )}
      {act.kind === 'text' && (
        <form onSubmit={async (e) => { e.preventDefault(); if (text.trim()) await send({ p_body: text.trim() }); }}>
          <div className="field">
            <label htmlFor="ans">جوابك <span className="hint">يراه معلمك أولاً، ثم يعرضه على الصف إن شاء</span></label>
            <textarea id="ans" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={3} required />
          </div>
          <button className="btn btn-primary" data-testid="live-send">أرسل</button>
        </form>
      )}
      {sent && <p className={s.sent} role="status" data-testid="live-sent">وصل جوابك ✓</p>}
      {err && <p role="alert" className="notice notice-error">{err}</p>}
      {ses.reveal && act.kind !== 'pin' && <><h2 style={{ fontSize: 'var(--step-1)' }}>نتائج الصف</h2><ResultsView act={{ ...act, image: null }} res={res} reveal /></>}
    </main>
  );
}
