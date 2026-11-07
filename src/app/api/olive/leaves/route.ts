import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// قائمة مضغوطة بالأوراق المنشورة للرسم: المعرّف ومؤشر المحافظة ومؤشر المدرسة فقط (بلا نصوص)
export async function GET() {
  const supabase = await createClient();
  const { data: govs } = await supabase.from('places').select('id').eq('kind', 'governorate').order('key');
  const gIndex = new Map((govs ?? []).map((g, i) => [g.id, i]));
  const ids: string[] = [], g: number[] = [], sch: (string | null)[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('olive_leaves').select('id, governorate_id, school_id')
      .eq('status', 'published').order('created_at').range(from, from + 999);
    if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
    for (const r of data ?? []) { ids.push(r.id); g.push(gIndex.get(r.governorate_id) ?? 0); sch.push(r.school_id); }
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ ids, g, s: sch }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' } });
}
