'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';
import { openChannel } from '@/lib/client/realtime';
import { postTwin, reviewTwin, type PostState } from '@/lib/actions/classroom';
import { JordanMap } from '@/components/classroom/JordanMap';
import { play, buzz } from '@/lib/client/sound';
import s from '@/components/classroom/ui.module.css';

export type TwinInfo = { id: string; status: string; mine: string; theirs: string; my_school: string; their_school: string; my_gov: string; their_gov: string;
  my_lat: number; my_lng: number; their_lat: number; their_lng: number; i_am_teacher: boolean; approved: number };
export type Msg = { id: string; mine: boolean; parent: string | null; kind: 'question' | 'answer'; body: string; status: 'pending' | 'approved' | 'rejected';
  reason: string | null; at: string; by: string; media: { id: string; kind: 'image' | 'audio'; url: string; w: number | null; h: number | null; alt: string | null }[] };

const day = (d: string) => new Intl.DateTimeFormat('ar-JO-u-nu-arab', { day: 'numeric', month: 'long' }).format(new Date(d));
const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);

/** صندوق الرسائل بين صفين: الخط بين المدرستين يضيء مع كل رسالة معتمدة */
export function Mailbox({ twin, messages, isTeacher, meMember }: { twin: TwinInfo; messages: Msg[]; isTeacher: boolean; meMember: string | null }) {
  const router = useRouter();
  const [pulse, setPulse] = useState(0);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const seen = useRef(new Set(messages.filter((m) => m.status === 'approved').map((m) => m.id)));
  // رسالة معتمدة جديدة: نبضة على الخريطة وتحديث الصفحة
  useEffect(() => {
    const close = openChannel(browserClient(), (sb) => sb.channel(`twin:${twin.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'twin_messages', filter: `twinning_id=eq.${twin.id}` }, () => router.refresh())
      .subscribe());
    // احتياط إن انقطع الاتصال اللحظي
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 20_000);
    return () => { close(); clearInterval(t); };
  }, [twin.id, router]);
  useEffect(() => {
    const fresh = messages.filter((m) => m.status === 'approved' && !seen.current.has(m.id));
    if (fresh.length) { fresh.forEach((m) => seen.current.add(m.id)); setPulse((p) => p + 1); play('chime'); buzz(10); } // eslint-disable-line react-hooks/set-state-in-effect
  }, [messages]);
  useEffect(() => { const t = setTimeout(() => setPulse(1), 600); return () => clearTimeout(t); }, []);

  const questions = messages.filter((m) => m.kind === 'question');
  const answers = (q: string) => messages.filter((m) => m.parent === q);
  const pending = messages.filter((m) => m.mine && m.status === 'pending');

  return (
    <div className={s.page} style={{ paddingTop: 'var(--space-4)' }}>
      <header className={s.head}>
        <p className={s.kicker}>توأمة المدارس</p>
        <h1>{twin.my_school} ⇄ {twin.their_school}</h1>
        <p className={s.lede}>{twin.my_gov} و{twin.their_gov}. كل صف يسأل الآخر عن بلدته، ويجيب بالصور والتسجيلات والنصوص بعد مراجعة المعلم.</p>
      </header>
      <div className={s.grid2}>
        <div className={s.panel}>
          <JordanMap label={`خط بين ${twin.my_gov} و${twin.their_gov}`} pulse={pulse}
            a={{ lat: twin.my_lat, lng: twin.my_lng, label: twin.my_gov }} b={{ lat: twin.their_lat, lng: twin.their_lng, label: twin.their_gov }} />
          <p className={s.itemMeta} data-testid="approved-count">{ar(messages.filter((m) => m.status === 'approved').length)} رسالة عبرت بين المدرستين</p>
        </div>
        <Compose twinId={twin.id} replyTo={replyTo} onDone={() => { setReplyTo(null); router.refresh(); }} isTeacher={isTeacher} />
      </div>

      {isTeacher && pending.length > 0 && (
        <section className={s.section} style={{ marginTop: 'var(--space-7)' }} aria-labelledby="rv-h">
          <h2 id="rv-h">بانتظار مراجعتك <span className={s.pill}>{ar(pending.length)}</span></h2>
          <p className={s.note}>لا يرى الصف التوأم هذه الرسائل حتى توافق عليها. ارفض ما فيه اسم حقيقي أو عنوان أو رقم هاتف أو صورة لوجه طالب.</p>
          <ul className={s.thread}>{pending.map((m) => <Review key={m.id} twinId={twin.id} m={m} />)}</ul>
        </section>
      )}

      <section className={s.section} style={{ marginTop: 'var(--space-7)' }} aria-labelledby="th-h">
        <h2 id="th-h">الأسئلة والأجوبة</h2>
        {!questions.length ? <p className="empty-state">لا رسائل بعد. ابدأ بسؤال عن بلدة صف التوأم.</p> : (
          <ul className={s.thread} data-testid="thread">
            {questions.filter((q) => q.status !== 'rejected' || q.mine).map((q) => (
              <li key={q.id}>
                <Bubble m={q} mineMember={meMember} />
                <ul className={s.answers}>{answers(q.id).filter((a) => a.status !== 'rejected' || a.mine).map((a) => <li key={a.id}><Bubble m={a} mineMember={meMember} /></li>)}</ul>
                {!q.mine && q.status === 'approved' && <button type="button" className="btn btn-quiet" onClick={() => { setReplyTo(q); scrollTo({ top: 0, behavior: 'smooth' }); }} data-testid="reply">أجب عن هذا السؤال</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Bubble({ m }: { m: Msg; mineMember: string | null }) {
  return (
    <article className={`${s.msg} ${m.mine ? s.msgMine : s.msgTheirs} ${m.status === 'pending' ? s.msgPending : ''}`} data-status={m.status}>
      <p className={s.msgHead}>
        <span className={s.msgFrom}>{m.by}</span><span>{m.kind === 'question' ? 'سأل' : 'أجاب'}</span><span>{day(m.at)}</span>
        {m.status === 'pending' && <span className={`${s.pill} ${s.pillWait}`}>بانتظار المعلم</span>}
        {m.status === 'rejected' && <span className={s.pill}>لم يُعتمد{m.reason ? `: ${m.reason}` : ''}</span>}
      </p>
      <p className={s.msgBody}>{m.body}</p>
      {m.media.length > 0 && (
        <div className={s.media}>
          {m.media.map((x) => x.kind === 'image'
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={x.id} src={x.url} alt={x.alt ?? 'صورة من الصف'} width={x.w ?? undefined} height={x.h ?? undefined} loading="lazy" />
            : <audio key={x.id} src={x.url} controls preload="none" aria-label="تسجيل صوتي" />)}
        </div>
      )}
    </article>
  );
}

function Review({ twinId, m }: { twinId: string; m: Msg }) {
  const [busy, start] = useTransition();
  const [reason, setReason] = useState('');
  return (
    <li>
      <Bubble m={m} mineMember={null} />
      <div className={s.row} style={{ marginTop: 'var(--space-2)' }}>
        <button type="button" className="btn btn-primary" disabled={busy} data-testid="approve" onClick={() => start(async () => { await reviewTwin(twinId, m.id, true); play('snap'); })}>وافق وأرسل</button>
        <label htmlFor={`r-${m.id}`} className="sr-only">سبب الرفض</label>
        <input id={`r-${m.id}`} type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الرفض (يراه الطالب)" style={{ maxWidth: '18rem' }} />
        <button type="button" className="btn" disabled={busy || !reason.trim()} onClick={() => start(() => reviewTwin(twinId, m.id, false, reason.trim()))}>ارفض</button>
      </div>
    </li>
  );
}

/** الكتابة: نص، وصورة يُعاد ترميزها في المتصفح (تُزال بيانات الموقع)، وتسجيل صوتي حتى ثلاث دقائق */
function Compose({ twinId, replyTo, onDone, isTeacher }: { twinId: string; replyTo: Msg | null; onDone: () => void; isTeacher: boolean }) {
  const [st, action, pending] = useActionState(postTwin.bind(null, twinId), { status: 'idle' } as PostState);
  const [img, setImg] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(null);
  const [rec, setRec] = useState<{ blob: Blob; url: string; sec: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const t0 = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (st.status === 'ok') { form.current?.reset(); setImg(null); setRec(null); onDone(); play('pop'); } }, [st]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  async function pickImage(f: File | undefined) {
    if (!f) return;
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
    setImg({ blob, url: URL.createObjectURL(blob), w: c.width, h: c.height });
  }
  async function toggleRec() {
    if (recording) { mr.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream); const chunks: Blob[] = [];
      m.ondataavailable = (e) => chunks.push(e.data);
      m.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setRecording(false); const blob = new Blob(chunks, { type: m.mimeType }); setRec({ blob, url: URL.createObjectURL(blob), sec: (performance.now() - t0.current) / 1000 }); };
      mr.current = m; t0.current = performance.now(); m.start(); setRecording(true);
      setTimeout(() => { if (m.state === 'recording') m.stop(); }, 180_000);
    } catch { alert('لم نستطع الوصول إلى الميكروفون.'); }
  }
  const submit = (fd: FormData) => {
    if (img) { fd.append('media', new File([img.blob], 'photo.jpg', { type: 'image/jpeg' })); fd.set('w0', String(img.w)); fd.set('h0', String(img.h)); }
    if (rec) { const i = img ? 1 : 0; fd.append('media', new File([rec.blob], 'voice', { type: rec.blob.type })); fd.set(`s${i}`, String(Math.round(rec.sec))); }
    return action(fd);
  };
  return (
    <form ref={form} action={submit} className={s.panel} data-testid="compose">
      <h2 style={{ fontSize: 'var(--step-1)' }}>{replyTo ? 'جواب على سؤالهم' : 'سؤال جديد لصف التوأم'}</h2>
      {replyTo && <p className={s.note}>«{replyTo.body.slice(0, 120)}»</p>}
      {st.status === 'ok' && <p role="status" className="notice notice-ok">{st.message}</p>}
      {st.status === 'error' && <p role="alert" className="notice notice-error">{st.message}</p>}
      <input type="hidden" name="kind" value={replyTo ? 'answer' : 'question'} />
      {replyTo && <input type="hidden" name="parent" value={replyTo.id} />}
      <div className="field">
        <label htmlFor="body">{replyTo ? 'جوابكم' : 'سؤالكم عن بلدتهم'} <span className="hint">لا تكتب أسماء حقيقية ولا عناوين ولا أرقام هواتف</span></label>
        <textarea id="body" name="body" rows={4} minLength={2} maxLength={1200} required />
      </div>
      <div className={s.row}>
        <label className="btn" style={{ marginBottom: 0 }}>
          📷 صورة<input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
        </label>
        <button type="button" className={`btn ${recording ? 'btn-danger' : ''}`} onClick={toggleRec} aria-pressed={recording}>{recording ? '■ أوقف التسجيل' : '🎙 سجّل صوتاً'}</button>
      </div>
      {(img || rec) && (
        <div className={s.media}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img.url} alt="الصورة المختارة" />}
          {rec && <audio src={rec.url} controls />}
        </div>
      )}
      {img && <div className="field" style={{ marginTop: 'var(--space-3)' }}><label htmlFor="alt">وصف قصير للصورة</label><input id="alt" name="alt" type="text" maxLength={200} /></div>}
      <p className={s.note} style={{ marginTop: 'var(--space-3)' }}>{isTeacher ? 'رسالتك تُرسل مباشرة.' : 'تصل رسالتك إلى معلمك أولاً، ويراها الصف التوأم بعد موافقته.'}</p>
      <div className={s.row}>
        <button className="btn btn-primary" disabled={pending} data-testid="send">{pending ? 'تُرسل…' : 'أرسل'}</button>
        {replyTo && <button type="button" className="btn btn-quiet" onClick={() => onDone()}>إلغاء</button>}
      </div>
    </form>
  );
}
