import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { OliveExplorer } from '@/components/olive/OliveExplorer';
import type { TreeState } from '@/components/olive/tree';
import s from './page.module.css';

export const metadata: Metadata = { title: 'زيتونة الوطن', description: 'شجرة زيتون عتيقة تنمو بذكريات الناس من محافظات الأردن.' };

export default async function Olive({ searchParams }: { searchParams: Promise<{ planted?: string }> }) {
  const { planted } = await searchParams;
  const supabase = await createClient();
  const v = await getViewer();
  const [{ data: st }, { data: govs }, { data: schools }, { data: buds }] = await Promise.all([
    supabase.rpc('olive_state'),
    supabase.from('places').select('id, key, name_ar').eq('kind', 'governorate').order('key'),
    supabase.from('schools').select('id, name').eq('public_listing', true).order('name'),
    v ? supabase.from('olive_leaves').select('id, governorate_id').eq('status', 'pending') : Promise.resolve({ data: [] }),
  ]);
  const state = (st ?? { total: 0, branches: 0, blooming: false, golden: false, season: 'autumn' }) as TreeState;
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>المشاركة</p>
        <h1>زيتونة الوطن</h1>
        <p className={s.lede}>شجرة زيتون عتيقة على تلال عجلون، لكل محافظة غصن فيها. كل ذكرى ورقة تنبت على غصن محافظتها بعد أن يراجعها الأمين. كل مئة ورقة غصن جديد، وكل ألف ورقة تزهر الشجرة، وعند خمسة آلاف تحمل زيتوناً ذهبياً.</p>
      </header>
      <OliveExplorer state={state} govs={govs ?? []} schools={schools ?? []} signedIn={!!v}
        buds={(buds ?? []) as { id: string; governorate_id: string }[]} planted={planted && /^[0-9a-f-]{36}$/.test(planted) ? planted : null} />
    </main>
  );
}
