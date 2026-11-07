import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import type { GrandMosaic } from '@/lib/grand';
import { GrandPuzzle } from '@/components/grand/GrandPuzzle';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'جزء صفنا من الفسيفساء' };

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const v = await requireViewer(`/grand/${section}`);
  if (!/^[0-9a-f-]{36}$/.test(section)) notFound();
  const supabase = await createClient();
  // RLS: المطالبة تظهر لطلاب الصف المتبنّي ومعلمه فقط
  const [{ data: claim }, { data: sec }] = await Promise.all([
    supabase.from('grand_claims').select('class_id').eq('section_id', section).maybeSingle(),
    supabase.from('grand_sections').select('id, idx, state, moves, completed_at, mosaic_id').eq('id', section).maybeSingle(),
  ]);
  if (!sec || !claim) notFound();
  const [{ data: m }, { data: mates }, { data: me }] = await Promise.all([
    supabase.from('grand_mosaics').select('*').eq('id', sec.mosaic_id).single(),
    supabase.rpc('my_classmates', { p_class: claim.class_id }),
    supabase.rpc('my_class'),
  ]);
  const meRow = (me as { member_id: string; pseudonym: string }[] | null)?.[0];
  const names = Object.fromEntries(((mates ?? []) as { member_id: string; pseudonym: string }[]).map((x) => [x.member_id, x.pseudonym]));
  return (
    <main className={s.page} style={{ maxWidth: 1400 }}>
      <p className={s.crumb}><Link href="/grand">الفسيفساء الكبرى</Link> / جزء صفنا</p>
      <GrandPuzzle mosaic={m as GrandMosaic} section={{ id: sec.id, idx: sec.idx, state: sec.state as number[], moves: sec.moves, done: !!sec.completed_at }}
        me={{ id: meRow?.member_id ?? `t:${v.id}`, name: meRow?.pseudonym ?? 'المعلم' }} names={names} />
    </main>
  );
}
