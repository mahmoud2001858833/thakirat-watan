import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtNumber } from '@/i18n';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/viewer';
import { toggleMosaic } from '@/lib/actions/features';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'لوحات الترميم' };

export default async function AdminMosaics({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('mosaics').select('id, slug, title_ar, grid, published, credit, license, mosaic_completions(count)').order('sort');
  return (
    <main className="page">
      <div className="page-head"><div><h1>لوحات الترميم</h1><p>اللوحات المنشورة تظهر في مختبر الترميم. الإكمال يُحصى بلا أي بيانات شخصية.</p></div></div>
      <Flash ok={ok} error={error} />
      <div className="ledger-wrap"><table className="ledger">
        <thead><tr><th scope="col">اللوحة</th><th scope="col">القطع</th><th scope="col">مرات الإكمال</th><th scope="col">الصورة</th><th scope="col">الحالة</th></tr></thead>
        <tbody>{(data ?? []).map((m) => (
          <tr key={m.id}>
            <td><Link href={`/restoration/${m.slug}`}>{m.title_ar}</Link></td>
            <td>{fmtNumber(m.grid * m.grid)}</td>
            <td data-testid={`completions-${m.slug}`}>{fmtNumber((m.mosaic_completions as unknown as { count: number }[])[0]?.count ?? 0)}</td>
            <td><bdi>{m.credit}</bdi> · <bdi>{m.license}</bdi></td>
            <td><form action={toggleMosaic.bind(null, m.id, !m.published)}><button className={`btn ${m.published ? 'btn-quiet' : 'btn-primary'}`}>{m.published ? 'منشورة — أخفها' : 'مخفية — انشرها'}</button></form></td>
          </tr>))}
        </tbody>
      </table></div>
    </main>
  );
}
