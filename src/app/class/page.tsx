import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer, hasRole } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { fmtNumber } from '@/i18n';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'صفي' };

type Me = { class_id: string; pseudonym: string; class_name: string; school: string; governorate: string | null };
type Twin = { id: string; status: string; their_school: string; their_gov: string; approved: number };

export default async function MyClass() {
  const v = await requireViewer('/class');
  const supabase = await createClient();
  if (!hasRole(v, 'student')) {
    return <main className={s.page}><header className={s.head}><h1>صفي</h1><p className={s.lede}>هذه صفحة الطلاب. {hasRole(v, 'teacher') ? <Link href="/teach">صفوفك هنا</Link> : 'ادخل برمز الدخول من معلمك.'}</p></header></main>;
  }
  const [{ data: me }, { data: twins }, { data: claim }, { data: lives }] = await Promise.all([
    supabase.rpc('my_class'), supabase.rpc('my_twinnings'),
    supabase.from('grand_claims').select('section_id').maybeSingle(),
    supabase.from('live_sessions').select('id, title').eq('status', 'open').order('created_at', { ascending: false }).limit(1),
  ]);
  const m = (me as Me[] | null)?.[0];
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>{m?.school}{m?.governorate && ` · ${m.governorate}`}</p>
        <h1>أهلاً، {m?.pseudonym}</h1>
        <p className={s.lede}>هذا صفك «{m?.class_name}». اسمك هنا مستعار، ولا يرى أحد خارج صفك ما تكتبه قبل أن يراجعه معلمك.</p>
      </header>
      <ol className={s.list}>
        <li>
          <div><span className={s.itemTitle}>الجلسة المباشرة</span><p className={s.itemMeta} style={{ margin: 0 }}>{lives?.length ? `جلسة مفتوحة الآن: ${lives[0].title}` : 'لا جلسة مفتوحة الآن.'}</p></div>
          {lives?.length ? <Link className="btn btn-primary" href={`/live/${lives[0].id}/play`}>ادخل الآن</Link> : <Link className="btn" href="/join">ادخل برمز</Link>}
        </li>
        {((twins ?? []) as Twin[]).filter((t) => t.status === 'active').map((t) => (
          <li key={t.id}>
            <div><span className={s.itemTitle}>صندوق الرسائل مع {t.their_school}</span><p className={s.itemMeta} style={{ margin: 0 }}>{t.their_gov} · {fmtNumber(t.approved)} رسالة</p></div>
            <Link className="btn" href={`/twin/${t.id}`}>افتح الصندوق</Link>
          </li>
        ))}
        <li>
          <div><span className={s.itemTitle}>الفسيفساء الكبرى</span><p className={s.itemMeta} style={{ margin: 0 }}>{claim ? 'لصفك جزء ترمّمونه معاً.' : 'لم يتبنَّ صفك جزءاً بعد.'}</p></div>
          {claim ? <Link className="btn" href={`/grand/${claim.section_id}`}>رمّم جزءنا</Link> : <Link className="btn btn-quiet" href="/grand">شاهد اللوحة</Link>}
        </li>
      </ol>
    </main>
  );
}
