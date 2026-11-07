import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer, hasRole } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { createClass } from '@/lib/actions/classroom';
import { fmtNumber } from '@/i18n';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'صفوفي' };

export default async function Teach({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const v = await requireViewer('/teach');
  const { error } = await searchParams;
  const supabase = await createClient();
  const teacherSchools = v.roles.filter((r) => r.role === 'teacher' && r.school_id).map((r) => r.school_id!);
  if (!hasRole(v, 'teacher')) {
    return (
      <main className={s.page}>
        <header className={s.head}><p className={s.kicker}>للمعلمين</p><h1>صفوفي</h1>
          <p className={s.lede}>هذه الصفحة للمعلمين. اطلب من إدارة المنصة أن تمنحك دور «معلم» في مدرستك، ثم تعود هنا لتنشئ صفك وتضيف طلابك بأسماء مستعارة.</p></header>
      </main>
    );
  }
  const [{ data: classes }, { data: schools }] = await Promise.all([
    supabase.from('classes').select('id, name, grade, school_id, open_for_twinning, class_members(count), schools(name)').eq('teacher_id', v.id).order('created_at'),
    supabase.from('schools').select('id, name').in('id', teacherSchools),
  ]);
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>للمعلمين</p>
        <h1>صفوفي</h1>
        <p className={s.lede}>من هنا تدير صفوفك: تضيف طلابك بأسماء مستعارة، وتوأم صفك مع صف في محافظة بعيدة، وتفتح جلسة مباشرة، وتتبنى جزءاً من الفسيفساء الكبرى.</p>
      </header>
      <ul className={s.rules}>
        <li className={s.rule}>كل ما يكتبه طالبك يمر بك قبل أن يراه أحد خارج صفك.</li>
        <li className={s.rule}>الطلاب بأسماء مستعارة ورموز دخول منك، بلا بريد ولا رقم هاتف.</li>
        <li className={s.rule}>لا رسائل خاصة بين الطلاب، ولا تواصل مع المدرسة التوأم إلا بمحتوى راجعه معلمه.</li>
      </ul>
      {error && <p role="alert" className="notice notice-error">تعذّر إنشاء الصف. تحقق من الاسم.</p>}
      <section className={s.section} aria-labelledby="cls-h">
        <h2 id="cls-h">صفوفي</h2>
        {!classes?.length ? <p className="empty-state">لا صفوف بعد. أنشئ صفك الأول.</p> : (
          <ul className={s.list}>
            {classes.map((c) => (
              <li key={c.id}>
                <div>
                  <Link href={`/teach/${c.id}`} className={s.itemTitle}>{c.name}</Link>
                  <p className={s.itemMeta} style={{ margin: 0 }}>{(c.schools as unknown as { name: string } | null)?.name}{c.grade ? ` · الصف ${fmtNumber(c.grade)}` : ''} · {fmtNumber((c.class_members as unknown as { count: number }[])[0]?.count ?? 0)} طالباً</p>
                </div>
                <Link href={`/teach/${c.id}`} className="btn">افتح الصف</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${s.section} ${s.panel}`} aria-labelledby="new-h" style={{ maxWidth: '40rem' }}>
        <h2 id="new-h" style={{ fontSize: 'var(--step-1)' }}>صف جديد</h2>
        <form action={createClass}>
          <div className="field-row">
            <div className="field"><label htmlFor="name">اسم الصف</label><input id="name" name="name" type="text" required maxLength={80} placeholder="السابع أ" /></div>
            <div className="field"><label htmlFor="grade">الصف الدراسي</label><input id="grade" name="grade" type="number" min={1} max={12} /></div>
          </div>
          <div className="field">
            <label htmlFor="school_id">المدرسة</label>
            <select id="school_id" name="school_id" required>{schools?.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}</select>
          </div>
          <button className="btn btn-primary">أنشئ الصف</button>
        </form>
      </section>
    </main>
  );
}
