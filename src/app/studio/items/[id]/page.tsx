import Link from 'next/link';
import type { Metadata } from 'next';
import { requireViewer, isStaff, hasRole } from '@/lib/viewer';
import { loadItem } from '@/lib/load-item';
import { ItemWorkbench } from '@/components/editor/ItemWorkbench';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'تحرير المادة' };

export default async function StudioItem({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const v = await requireViewer(`/studio/items/${id}`);
  const { ok, error } = await searchParams;
  const data = await loadItem(id);
  return (
    <main className="page">
      <div className="page-head">
        <div><p><Link href="/studio">مساهماتي</Link></p><h1>{data.item.title_ar}</h1></div>
      </div>
      <Flash ok={ok} error={error} />
      <ItemWorkbench {...data} mode="studio" staff={false} isAdmin={hasRole(v, 'admin')} isOwner={data.item.contributor_id === v.id} />
      {isStaff(v) && <p><Link href={`/admin/items/${id}`}>افتح في غرفة الأمين</Link></p>}
    </main>
  );
}
