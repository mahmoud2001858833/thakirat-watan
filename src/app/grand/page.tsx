import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Board } from '@/lib/grand';
import { GrandBoard } from '@/components/grand/GrandBoard';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'الفسيفساء الكبرى', description: 'لوحة فسيفساء واحدة يرمّمها طلاب مدارس الأردن معاً، لكل صف جزء.' };

export default async function Grand({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const supabase = await createClient();
  const { data: list } = await supabase.from('grand_mosaics').select('slug, title_ar, is_demo').eq('published', true).order('is_demo').order('created_at');
  const slug = list?.find((x) => x.slug === m)?.slug ?? list?.[0]?.slug;
  const { data } = slug ? await supabase.rpc('grand_board', { p_slug: slug }) : { data: null };
  const board = data as Board | null;
  return (
    <main className={s.page} style={{ maxWidth: 1500 }}>
      <header className={s.head}>
        <p className={s.kicker}>المشاركة بين المدارس</p>
        <h1>الفسيفساء الكبرى</h1>
        <p className={s.lede}>لوحة واحدة لكل مدارس الأردن. يتبنى كل صف جزءاً منها ويرمّمه طلابه معاً، كلٌّ من جهازه وفي الوقت نفسه. حين تكتمل الأجزاء كلها تظهر اللوحة كاملة، وعلى كل جزء اسم مدرسته.</p>
      </header>
      {(list?.length ?? 0) > 1 && (
        <nav className={s.row} aria-label="اللوحات" style={{ marginBottom: 'var(--space-5)' }}>
          {list!.map((x) => <Link key={x.slug} href={`/grand?m=${x.slug}`} className={`btn ${x.slug === slug ? 'btn-primary' : ''}`} aria-current={x.slug === slug ? 'page' : undefined}>{x.title_ar}{x.is_demo ? ' (تجريبي)' : ''}</Link>)}
        </nav>
      )}
      {board ? <GrandBoard initial={board} /> : <p className="empty-state">لا لوحة منشورة بعد.</p>}
    </main>
  );
}
