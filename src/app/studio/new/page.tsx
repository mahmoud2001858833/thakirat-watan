import type { Metadata } from 'next';
import { requireViewer, isStaff } from '@/lib/viewer';
import { createItem } from '@/lib/actions/items';
import { ItemFields } from '@/components/editor/ItemFields';
import { Flash } from '@/components/Flash';

export const metadata: Metadata = { title: 'مادة جديدة' };

export default async function NewItem({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const v = await requireViewer('/studio/new');
  const { error } = await searchParams;
  return (
    <main className="page">
      <div className="page-head"><div><h1>مادة جديدة</h1><p>ستُحفظ مسودة خاصة بك. تضيف المصادر والموافقة بعد الحفظ.</p></div></div>
      <div style={{ maxWidth: '46rem' }}>
        <Flash error={error} />
        <form action={createItem}>
          <input type="hidden" name="return" value="studio" />
          <ItemFields staff={isStaff(v)} />
          <button className="btn btn-primary">احفظ المسودة</button>
        </form>
      </div>
    </main>
  );
}
