import type { Metadata } from 'next';
import { fmtDate } from '@/i18n';
import { requireAdmin } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { createSchool } from '@/lib/actions/admin';
import { Flash } from '@/components/Flash';
import { DemoTag } from '@/components/TrustBadge';

export const metadata: Metadata = { title: 'المدارس' };

export default async function Schools({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: schools } = await supabase.from('schools').select('id, name, public_listing, is_demo, created_at, classes(count)').order('created_at', { ascending: false });
  return (
    <main className="page">
      <div className="page-head"><div><h1>المدارس</h1><p>إدارة المدرسة تُمنح من صفحة المستخدمين بعد إنشاء المدرسة.</p></div></div>
      <Flash ok={ok} error={error} />
      <form action={createSchool} style={{ maxWidth: '36rem', marginBottom: 'var(--space-6)' }}>
        <div className="field"><label htmlFor="name">اسم المدرسة</label><input id="name" name="name" type="text" minLength={2} maxLength={200} required /></div>
        <div className="field check"><input id="pl" name="public_listing" type="checkbox" /><label htmlFor="pl">تظهر في لوحة دوري المدارس العامة (بموافقة المدرسة)</label></div>
        <button className="btn btn-primary">أضف المدرسة</button>
      </form>
      {!schools?.length ? <p className="empty-state">لا مدارس بعد.</p> : (
        <div className="ledger-wrap"><table className="ledger">
          <thead><tr><th scope="col">المدرسة</th><th scope="col">الصفوف</th><th scope="col">ظاهرة للعامة</th><th scope="col">أُضيفت</th></tr></thead>
          <tbody>{schools.map((sc) => (
            <tr key={sc.id}>
              <td>{sc.name} {sc.is_demo && <DemoTag />}</td>
              <td>{(sc.classes as unknown as { count: number }[])[0]?.count ?? 0}</td>
              <td>{sc.public_listing ? 'نعم' : 'لا'}</td>
              <td>{fmtDate(sc.created_at)}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
