import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import s from './leaf.module.css';

async function getLeaf(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('olive_leaves').select('body, is_demo, places(name_ar)').eq('id', id).eq('status', 'published').maybeSingle();
  return data as unknown as { body: string; is_demo: boolean; places: { name_ar: string } } | null;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const l = await getLeaf((await params).id);
  return l ? { title: `ورقة من ${l.places.name_ar}`, description: l.body.slice(0, 150) } : { title: 'زيتونة الوطن' };
}
/** صفحة مشاركة: الذكرى ومحافظتها فقط، بلا أي بيانات عن صاحبها */
export default async function LeafPage({ params }: { params: Promise<{ id: string }> }) {
  const l = await getLeaf((await params).id);
  if (!l) notFound();
  return (
    <main className={s.page}>
      <article className={s.card}>
        <svg viewBox="0 0 120 60" className={s.leaf} aria-hidden="true"><path d="M4 30 Q60 -6 116 30 Q60 66 4 30 Z" fill="#6e7b4f" /><path d="M8 30 L112 30" stroke="#c9d0b0" strokeWidth="1.5" /></svg>
        <p className={s.gov}>ورقة من {l.places.name_ar}{l.is_demo && <span className={s.demo}>تجريبي</span>}</p>
        <blockquote className={s.quote}>{l.body}</blockquote>
        <Link href="/olive" className="btn btn-primary">إلى زيتونة الوطن</Link>
      </article>
    </main>
  );
}
