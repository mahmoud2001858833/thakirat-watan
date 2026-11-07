import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dims, getMosaic, steps } from '@/lib/mosaics';
import { Restorer } from './Restorer';
import { createClient } from '@/lib/supabase/server';
import type { Best } from './Leaderboard';
import s from '../lab.module.css';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await getMosaic((await params).slug);
  return { title: m ? `ترميم: ${m.title_ar}` : 'مختبر الترميم' };
}

export default async function Board({ params }: { params: Promise<{ slug: string }> }) {
  const m = await getMosaic((await params).slug);
  if (!m) notFound();
  const d = dims(m.image_path);
  const { data: best } = await (await createClient()).rpc('mosaic_leaderboard', { p_slug: m.slug });
  return (
    <main className={s.page}>
      <p className={s.crumb}><Link href="/restoration">مختبر الترميم</Link> / {m.title_ar}</p>
      <Restorer mosaic={m} width={d.width} height={d.height} steps={steps} best={(best ?? []) as Best[]} />
    </main>
  );
}
