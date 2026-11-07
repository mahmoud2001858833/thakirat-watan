import type { Metadata } from 'next';
import { fmtDate, fmtNumber } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { hasRole, requireStaff } from '@/lib/viewer';
import { purgeDemo, reviewLeaf } from '@/lib/actions/features';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'أوراق الزيتونة' };

export default async function AdminOlive({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const v = await requireStaff();
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: pending }, { data: st }, { count: demo }] = await Promise.all([
    supabase.from('olive_leaves').select('id, body, display_name, created_at, school_id, places(name_ar)').eq('status', 'pending').order('created_at').limit(200),
    supabase.rpc('olive_state'),
    supabase.from('olive_leaves').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ]);
  const state = st as { total: number; branches: number; blooming: boolean; golden: boolean; season: string } | null;
  return (
    <main className="page">
      <div className="page-head"><div><h1>أوراق الزيتونة</h1><p>كل ورقة تمر من هنا قبل أن تظهر للناس. أوراق الطلاب تحمل أسماءهم المستعارة.</p></div></div>
      <Flash ok={ok} error={error} />
      <p>منشورة: <strong>{fmtNumber(state?.total ?? 0)}</strong> · أغصان النمو: {fmtNumber(state?.branches ?? 0)} · {state?.blooming ? 'مزهرة' : 'لم تزهر بعد (ألف ورقة)'} · بانتظار المراجعة: <strong data-testid="pending-count">{fmtNumber(pending?.length ?? 0)}</strong> · تجريبية: {fmtNumber(demo ?? 0)}</p>
      {!pending?.length ? <p className="empty-state">لا أوراق بانتظار المراجعة.</p> : (
        <div className="ledger-wrap"><table className="ledger">
          <thead><tr><th scope="col">الورقة</th><th scope="col">المحافظة</th><th scope="col">الاسم الظاهر</th><th scope="col">الوقت</th><th scope="col">القرار</th></tr></thead>
          <tbody>{pending.map((l) => (
            <tr key={l.id}>
              <td style={{ maxWidth: '32ch' }}>{l.body}</td>
              <td>{(l.places as unknown as { name_ar: string }).name_ar}</td>
              <td>{l.display_name ?? '—'}{l.school_id && <span className="hint">طالب</span>}</td>
              <td>{fmtDate(l.created_at)}</td>
              <td>
                <form action={reviewLeaf.bind(null, l.id)} style={{ display: 'grid', gap: '0.4rem', minWidth: '14rem' }}>
                  <button name="decision" value="approve" className="btn btn-primary">انشرها</button>
                  <label htmlFor={`r-${l.id}`} className="sr-only">سبب الرفض</label>
                  <input id={`r-${l.id}`} name="reason" type="text" placeholder="سبب الرفض" maxLength={500} />
                  <button name="decision" value="reject" className="btn btn-danger">ارفضها</button>
                </form>
              </td>
            </tr>))}
          </tbody>
        </table></div>
      )}
      {hasRole(v, 'admin') && (
        <section style={{ marginTop: 'var(--space-8)', borderTop: '1px solid var(--line)', paddingTop: 'var(--space-5)', maxWidth: '40rem' }} aria-labelledby="demo-h">
          <h2 id="demo-h" style={{ fontSize: 'var(--step-2)' }}>المحتوى التجريبي</h2>
          <p>يحذف كل ما وُسم «تجريبي» في المنصة كلها (الأوراق والمواد والمدارس والصفوف) بأمر واحد، ويُسجَّل في سجل التدقيق. لا يمسّ المحتوى الحقيقي.</p>
          <form action={purgeDemo}><button className="btn btn-danger">احذف كل المحتوى التجريبي</button></form>
        </section>
      )}
    </main>
  );
}
