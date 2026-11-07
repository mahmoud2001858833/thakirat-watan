import Link from 'next/link';
import type { Metadata } from 'next';
import { getDict, fmtDate, fmtNumber } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import s from '../admin.module.css';

export const metadata: Metadata = { title: 'طابور المراجعة' };
const tabs = ['in_review', 'verified', 'draft', 'rejected', 'published', 'archived'] as const;

export default async function Review({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const t = getDict();
  const sp = await searchParams;
  const status = (tabs as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof tabs)[number]) : 'in_review';
  const supabase = await createClient();
  const type = sp.type === 'events' || sp.type === 'archive' ? sp.type : 'all';
  let q = supabase.from('items')
    .select('id, title_ar, kind, trust, is_demo, is_student_work, is_event, provenance, date_exact, updated_at, item_sources(count)')
    .eq('status', status);
  if (type === 'events') q = q.eq('is_event', true);
  if (type === 'archive') q = q.eq('is_event', false);
  const { data: items } = await q.order('updated_at', { ascending: status === 'in_review' }).limit(300);
  return (
    <main className="page">
      <div className="page-head"><div><h1>طابور المراجعة</h1><p>الأقدم أولاً في المراجعة. لا نشر دون مصدر ودرجة توثيق وحقوق.</p></div></div>
      <ul className={s.tabs}>
        {tabs.map((st) => (
          <li key={st}><Link href={`/admin/review?status=${st}&type=${type}`} aria-current={st === status ? 'page' : undefined}>{t.status[st]}</Link></li>
        ))}
      </ul>
      <ul className={s.tabs} aria-label="النوع">
        {([['all', 'الكل'], ['archive', 'مواد الأرشيف'], ['events', 'أحداث هذا اليوم']] as const).map(([k, label]) => (
          <li key={k}><Link href={`/admin/review?status=${status}&type=${k}`} aria-current={k === type ? 'page' : undefined}>{label}</Link></li>
        ))}
      </ul>
      {!items?.length ? <p className="empty-state">لا مواد في «{t.status[status]}».</p> : (
        <div className="ledger-wrap">
          <table className="ledger">
            <caption className="sr-only">{t.status[status]} — {fmtNumber(items.length)}</caption>
            <thead><tr><th scope="col">العنوان</th><th scope="col">النوع</th><th scope="col">التوثيق</th><th scope="col">المصادر</th><th scope="col">آخر تعديل</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/items/${i.id}`}>{i.title_ar}</Link>{' '}
                    {i.is_demo && <DemoTag />} {i.is_student_work && <span className="hint">عمل طالب</span>}
                    {i.provenance === 'assistant_research' && <span className="hint">أعدّه المساعد — بانتظار مراجعتك</span>}
                    {i.is_event && i.date_exact && <span className="hint">حدث: {i.date_exact}</span>}
                  </td>
                  <td>{t.kind[i.kind as keyof typeof t.kind]}</td>
                  <td><TrustBadge trust={i.trust} /></td>
                  <td>{fmtNumber((i.item_sources as unknown as { count: number }[])[0]?.count ?? 0)}</td>
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
