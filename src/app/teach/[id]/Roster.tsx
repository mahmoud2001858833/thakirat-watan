'use client';
import { useActionState, useState, useTransition } from 'react';
import { addStudents, removeStudent, resetStudentCode, type AddState } from '@/lib/actions/classroom';
import { play } from '@/lib/client/sound';
import s from '@/components/classroom/ui.module.css';

// أسماء مستعارة من طبيعة الأردن: لا تدل على الطالب، وسهلة التذكر
const WORDS = ['غزال', 'صقر', 'نورس', 'سنديانة', 'زيتونة', 'سوسنة', 'مرجان', 'وعل', 'قطا', 'نخلة', 'بلوطة', 'سنونو', 'حجل', 'ريحانة', 'عرار', 'نجمة', 'قمر', 'شيح', 'رمانة', 'ياسمين'];
const ar = (n: number) => new Intl.NumberFormat('ar-JO-u-nu-arab').format(n);
function generate(n: number, taken: Set<string>) {
  const out: string[] = [];
  for (let i = 0; out.length < n && i < 1000; i++) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)], name = `${w} ${ar(10 + Math.floor(Math.random() * 89))}`;
    if (!taken.has(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

type M = { id: string; pseudonym: string; login: string | null };

export function Roster({ classId, members }: { classId: string; members: M[] }) {
  const [state, action, pending] = useActionState(addStudents.bind(null, classId), { status: 'idle' } as AddState);
  const [names, setNames] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const taken = new Set(members.map((m) => m.pseudonym));
  const shown = state.status === 'ok' ? state.codes ?? [] : [];

  return (
    <div className={s.grid2}>
      <div>
        {!members.length ? <p className="empty-state">لا طلاب بعد.</p> : (
          <ul className={s.list} data-testid="roster">
            {members.map((m) => (
              <li key={m.id}>
                <div>
                  <span className={s.itemTitle}>{m.pseudonym}</span>
                  {codes[m.id] && <code className={s.code} data-testid="new-code">{codes[m.id]}</code>}
                </div>
                <div className={`${s.row} ${s.noPrint}`}>
                  {m.login && <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => start(async () => {
                    const c = await resetStudentCode(m.id); if (c) { setCodes((x) => ({ ...x, [m.id]: c })); play('pop'); }
                  })}>رمز جديد</button>}
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => {
                    if (confirm(`حذف «${m.pseudonym}» يحذف حسابه وكل ما كتبه. متأكد؟`)) start(() => removeStudent(classId, m.id));
                  }}>احذف</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`${s.panel} ${s.noPrint}`}>
        <h3 style={{ fontSize: 'var(--step-1)' }}>أضف طلاباً</h3>
        <form action={action}>
          {state.status === 'error' && <p role="alert" className="notice notice-error">{state.message}</p>}
          <div className="field">
            <label htmlFor="names">الأسماء المستعارة <span className="hint">اسم في كل سطر. لا تكتب الأسماء الحقيقية.</span></label>
            <textarea id="names" name="names" rows={6} value={names} onChange={(e) => setNames(e.target.value)} required />
          </div>
          <div className={s.row}>
            <button type="button" className="btn" onClick={() => { setNames(generate(5, taken).join('\n')); play('tap'); }}>اقترح ٥ أسماء</button>
            <button className="btn btn-primary" disabled={pending}>{pending ? 'جارٍ الإنشاء…' : 'أنشئ الحسابات'}</button>
          </div>
        </form>
      </div>
      {shown.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }} role="status">
          <h3 style={{ fontSize: 'var(--step-1)' }}>رموز الدخول — تظهر مرة واحدة</h3>
          <p className={s.note}>اطبع البطاقات أو انسخها الآن. لا نحفظ الرموز ولا نستطيع عرضها مرة أخرى؛ إن ضاع رمز فأنشئ رمزاً جديداً للطالب.</p>
          <div className={s.codes} data-testid="codes">
            {shown.map((c) => (
              <div key={c.code} className={s.codeCard}>
                <span className={s.codeName}>{c.pseudonym}</span>
                <code className={s.code}>{c.code}</code>
                <p className={s.codeHow}>ادخل من thakirat-watan.vercel.app/signin ← «أنا طالب»</p>
              </div>
            ))}
          </div>
          <button type="button" className={`btn ${s.noPrint}`} onClick={() => print()}>اطبع البطاقات</button>
        </div>
      )}
    </div>
  );
}
