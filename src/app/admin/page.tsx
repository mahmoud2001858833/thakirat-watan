import Link from 'next/link';
import type { Metadata } from 'next';
import { getDict, fmtNumber, fmtDate } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import s from './admin.module.css';

export const metadata: Metadata = { title: 'غرفة الأمين' };

const order = ['in_review', 'verified', 'draft', 'published', 'rejected', 'archived'] as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const t = getDict();
  const { denied } = await searchParams;
  const supabase = await createClient();
  const counts = await Promise.all(order.map((st) =>
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', st).then((r) => r.count ?? 0)));
  const [{ count: openReports }, { count: demo }, { data: recent }] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    supabase.from('review_events').select('id, item_id, from_status, to_status, at, items(title_ar)').order('id', { ascending: false }).limit(10),
  ]);
  return (
    <main className="page">
      <div className="page-head"><div><h1>نظرة عامة</h1><p>حالة الأرشيف الآن.</p></div></div>
      {denied && <p role="alert" className="notice notice-error">هذه الصفحة للمدير العام فقط.</p>}
      <dl className={s.stats}>
        {order.map((st, i) => (
          <div className={s.stat} key={st}>
            <dt>{t.status[st]}</dt>
            <dd><Link href={`/admin/review?status=${st}`}>{fmtNumber(counts[i])}</Link></dd>
          </div>
        ))}
        <div className={s.stat}><dt>بلاغات مفتوحة</dt><dd><Link href="/admin/reports">{fmtNumber(openReports ?? 0)}</Link></dd></div>
        <div className={s.stat}><dt>مواد تجريبية</dt><dd>{fmtNumber(demo ?? 0)}</dd></div>
      </dl>
      <h2 style={{ fontSize: 'var(--step-2)' }}>آخر الانتقالات</h2>
      {!recent?.length ? <p className="empty-state">لا نشاط بعد.</p> : (
        <div className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th scope="col">المادة</th><th scope="col">الانتقال</th><th scope="col">الوقت</th></tr></thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/admin/items/${e.item_id}`}>{(e.items as unknown as { title_ar: string } | null)?.title_ar ?? '—'}</Link></td>
                  <td>{t.status[e.from_status as keyof typeof t.status]} ← {t.status[e.to_status as keyof typeof t.status]}</td>
                  <td>{fmtDate(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
