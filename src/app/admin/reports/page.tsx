import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtDate } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { handleReport } from '@/lib/actions/admin';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'البلاغات' };
const reasons: Record<string, string> = { inaccurate: 'معلومة غير دقيقة', rights: 'حقوق', privacy: 'خصوصية', offensive: 'محتوى مسيء', other: 'أخرى' };

export default async function Reports({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: reports } = await supabase.from('reports')
    .select('id, item_id, reason, details, status, created_at, items(title_ar)').order('created_at', { ascending: false }).limit(200);
  return (
    <main className="page">
      <div className="page-head"><div><h1>البلاغات</h1><p>بلاغات الزوار عن المواد المنشورة.</p></div></div>
      <Flash ok={ok} error={error} />
      {!reports?.length ? <p className="empty-state">لا بلاغات.</p> : (
        <div className="ledger-wrap"><table className="ledger">
          <thead><tr><th scope="col">المادة</th><th scope="col">السبب</th><th scope="col">التفاصيل</th><th scope="col">الوقت</th><th scope="col">الحالة</th></tr></thead>
          <tbody>{reports.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/items/${r.item_id}`}>{(r.items as unknown as { title_ar: string } | null)?.title_ar ?? '—'}</Link></td>
              <td>{reasons[r.reason]}</td>
              <td>{r.details}</td>
              <td>{fmtDate(r.created_at)}</td>
              <td>{r.status === 'open' ? (
                <form action={handleReport.bind(null, r.id)} style={{ display: 'flex', gap: '0.5rem' }}>
                  <button name="status" value="resolved" className="btn">عولج</button>
                  <button name="status" value="dismissed" className="btn btn-quiet">تجاهل</button>
                </form>
              ) : r.status === 'resolved' ? 'عولج' : 'تُجوهل'}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
