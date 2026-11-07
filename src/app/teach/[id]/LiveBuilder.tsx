'use client';
import { useState, useTransition } from 'react';
import { openLive } from '@/lib/actions/classroom';
import { play } from '@/lib/client/sound';
import s from '@/components/classroom/ui.module.css';

type Kind = 'poll' | 'text' | 'pin';
type Act = { kind: Kind; prompt: string; options: string[]; image: string | null; item_id: string | null };
type Pic = { id: string; title: string; src: string };
const KIND: Record<Kind, string> = { poll: 'تصويت', text: 'إجابة قصيرة', pin: 'إشارة على الصورة' };

export function LiveBuilder({ classId, pictures }: { classId: string; pictures: Pic[] }) {
  const first = pictures[0];
  const [title, setTitle] = useState(first ? `قراءة صورة: ${first.title}` : 'جلسة');
  const [pic, setPic] = useState<Pic | undefined>(first);
  const [acts, setActs] = useState<Act[]>(() => [
    { kind: 'pin', prompt: 'ضع إشارة على أكثر تفصيل لفت نظرك في الصورة.', options: [], image: first?.src ?? null, item_id: first?.id ?? null },
    { kind: 'poll', prompt: 'ما الذي تخبرنا به هذه الصورة أكثر؟', options: ['من بناه', 'متى بُني', 'كيف عاش الناس هنا'], image: first?.src ?? null, item_id: first?.id ?? null },
    { kind: 'text', prompt: 'اكتب سؤالاً واحداً تتمنى أن تعرف جوابه عن هذا المكان.', options: [], image: first?.src ?? null, item_id: first?.id ?? null },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, p: Partial<Act>) => setActs((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const choosePic = (id: string) => {
    const p = pictures.find((x) => x.id === id); setPic(p);
    setActs((a) => a.map((x) => ({ ...x, image: p?.src ?? null, item_id: p?.id ?? null })));
  };
  return (
    <div className={s.panel} style={{ marginTop: 'var(--space-5)' }}>
      <h3 style={{ fontSize: 'var(--step-1)' }}>جلسة جديدة</h3>
      {err && <p role="alert" className="notice notice-error">{err}</p>}
      <div className="field-row">
        <div className="field"><label htmlFor="lt">عنوان الجلسة</label><input id="lt" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
        <div className="field">
          <label htmlFor="lp">صورة من الأرشيف</label>
          <select id="lp" value={pic?.id ?? ''} onChange={(e) => choosePic(e.target.value)}>
            {pictures.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>
      {pic && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pic.src} alt={pic.title} style={{ width: 'min(100%, 360px)', borderRadius: 12, boxShadow: 'var(--shadow-soft)', marginBottom: 'var(--space-4)' }} />
      )}
      <ol style={{ paddingInlineStart: '1.2em', display: 'grid', gap: 'var(--space-4)' }}>
        {acts.map((a, i) => (
          <li key={i}>
            <div className="field-row">
              <div className="field">
                <label htmlFor={`k${i}`}>النوع</label>
                <select id={`k${i}`} value={a.kind} onChange={(e) => set(i, { kind: e.target.value as Kind, options: e.target.value === 'poll' ? (a.options.length ? a.options : ['نعم', 'لا']) : [] })}>
                  {(Object.keys(KIND) as Kind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label htmlFor={`p${i}`}>السؤال</label><input id={`p${i}`} type="text" value={a.prompt} onChange={(e) => set(i, { prompt: e.target.value })} maxLength={300} /></div>
            </div>
            {a.kind === 'poll' && (
              <div className="field">
                <label htmlFor={`o${i}`}>الخيارات <span className="hint">خيار في كل سطر، حتى ستة</span></label>
                <textarea id={`o${i}`} rows={3} value={a.options.join('\n')} onChange={(e) => set(i, { options: e.target.value.split('\n').slice(0, 6) })} />
              </div>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setActs((x) => x.filter((_, j) => j !== i))} disabled={acts.length < 2}>احذف السؤال</button>
          </li>
        ))}
      </ol>
      <div className={s.row}>
        <button type="button" className="btn" onClick={() => { setActs((x) => [...x, { kind: 'poll', prompt: '', options: ['نعم', 'لا'], image: pic?.src ?? null, item_id: pic?.id ?? null }]); play('tap'); }} disabled={acts.length >= 20}>أضف سؤالاً</button>
        <button type="button" className="btn btn-primary" disabled={pending} data-testid="open-live" onClick={() => start(async () => {
          setErr(null);
          const r = await openLive(classId, title, JSON.stringify(acts.map((a) => ({ ...a, options: a.options.map((o) => o.trim()).filter(Boolean) }))));
          if (r?.error) setErr(r.error);
        })}>{pending ? 'تُفتح…' : 'افتح الجلسة'}</button>
      </div>
    </div>
  );
}
