import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtDate } from '@/i18n';
import { requireStaff, hasRole } from '@/lib/viewer';
import { loadItem } from '@/lib/load-item';
import { createClient } from '@/lib/supabase/server';
import { restoreVersion } from '@/lib/actions/items';
import { ItemWorkbench } from '@/components/editor/ItemWorkbench';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'مراجعة المادة' };

export default async function AdminItem({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const v = await requireStaff();
  const { ok, error } = await searchParams;
  const data = await loadItem(id);
  const supabase = await createClient();
  const { data: versions } = await supabase.from('content_versions')
    .select('id, created_at, data->>title_ar').eq('item_id', id).order('id', { ascending: false }).limit(20);
  return (
    <main className="page">
      <div className="page-head">
        <div><p><Link href={`/admin/review?status=${data.item.status}`}>طابور المراجعة</Link></p><h1>{data.item.title_ar}</h1></div>
      </div>
      <Flash ok={ok} error={error} />
      <ItemWorkbench {...data} mode="admin" staff isAdmin={hasRole(v, 'admin')} isOwner={data.item.contributor_id === v.id}>
        <section style={{ borderTop: '1px solid var(--rule)', marginTop: 'var(--space-7)', paddingTop: 'var(--space-5)' }} aria-labelledby="ver-h">
          <h2 id="ver-h" style={{ fontSize: 'var(--step-2)' }}>النسخ السابقة</h2>
          {!versions?.length ? <p className="hint">لا نسخ سابقة. تُحفظ نسخة تلقائياً قبل كل تعديل.</p> : (
            <div className="ledger-wrap">
              <table className="ledger">
                <thead><tr><th scope="col">العنوان في تلك النسخة</th><th scope="col">الوقت</th><th scope="col"><span className="sr-only">إجراء</span></th></tr></thead>
                <tbody>
                  {versions.map((ver) => (
                    <tr key={ver.id}>
                      <td>{(ver as unknown as { title_ar: string }).title_ar}</td>
                      <td>{fmtDate(ver.created_at)}</td>
                      <td>
                        <form action={restoreVersion.bind(null, id, ver.id)}><button className="btn btn-quiet">استرجع</button></form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </ItemWorkbench>
    </main>
  );
}
