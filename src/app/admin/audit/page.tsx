import type { Metadata } from 'next';
import { fmtDate } from '@/i18n';
import { requireAdmin } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'سجل التدقيق' };
const actions: Record<string, string> = {
  insert: 'إضافة', update: 'تعديل', delete: 'حذف', transition: 'تغيير حالة', consent_withdrawn: 'سحب موافقة',
  restore_version: 'استرجاع نسخة', purge_demo: 'حذف التجريبي',
};

export default async function Audit() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: rows } = await supabase.from('audit_log').select('id, at, actor, action, table_name, record_id, details').order('id', { ascending: false }).limit(300);
  return (
    <main className="page">
      <div className="page-head"><div><h1>سجل التدقيق</h1><p>إلحاقي فقط: لا يستطيع أحد تعديله أو حذفه. آخر ٣٠٠ عملية.</p></div></div>
      {!rows?.length ? <p className="empty-state">لا عمليات بعد.</p> : (
        <div className="ledger-wrap"><table className="ledger">
          <thead><tr><th scope="col">الوقت</th><th scope="col">العملية</th><th scope="col">الجدول</th><th scope="col">السجل</th><th scope="col">المنفّذ</th><th scope="col">التفاصيل</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtDate(r.at)}</td>
              <td>{actions[r.action] ?? r.action}</td>
              <td dir="ltr">{r.table_name ?? '—'}</td>
              <td dir="ltr"><code>{r.record_id?.slice(0, 8) ?? '—'}</code></td>
              <td dir="ltr"><code>{r.actor?.slice(0, 8) ?? 'system'}</code></td>
              <td><details><summary>عرض</summary><pre dir="ltr" style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', maxWidth: '40ch' }}>{JSON.stringify(r.details, null, 1)}</pre></details></td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
