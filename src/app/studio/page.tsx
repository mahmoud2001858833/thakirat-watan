import Link from 'next/link';
import type { Metadata } from 'next';
import { getDict, fmtDate } from '@/i18n';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { TrustBadge } from '@/components/TrustBadge';

export const metadata: Metadata = { title: 'مساهماتي' };

export default async function Studio() {
  const v = await requireViewer('/studio');
  const t = getDict();
  const supabase = await createClient();
  const { data: items } = await supabase.from('items')
    .select('id, title_ar, kind, status, trust, updated_at').eq('contributor_id', v.id).order('updated_at', { ascending: false });
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>مساهماتي</h1>
          <p>كل ما تضيفه يبدأ مسودة، ولا يُنشر إلا بعد مراجعة المختصين.</p>
        </div>
        <Link className="btn btn-primary" href="/studio/new">مادة جديدة</Link>
      </div>
      {!items?.length ? (
        <p className="empty-state">لم تضف شيئاً بعد. ابدأ بمادة واحدة: صورة قديمة، أو وثيقة، أو حكاية سمعتها من أهلك.</p>
      ) : (
        <div className="ledger-wrap">
          <table className="ledger">
            <caption className="sr-only">مساهماتي</caption>
            <thead><tr><th scope="col">العنوان</th><th scope="col">النوع</th><th scope="col">الحالة</th><th scope="col">التوثيق</th><th scope="col">آخر تعديل</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/studio/items/${i.id}`}>{i.title_ar}</Link></td>
                  <td>{t.kind[i.kind as keyof typeof t.kind]}</td>
                  <td><span className={`status status-${i.status}`}>{t.status[i.status as keyof typeof t.status]}</span></td>
                  <td><TrustBadge trust={i.trust} /></td>
                  <td>{fmtDate(i.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
