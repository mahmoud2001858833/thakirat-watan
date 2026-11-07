import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Session } from '@/lib/live';
import { LivePlay } from './LivePlay';

export const metadata: Metadata = { title: 'الجلسة' };

export default async function Play({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireViewer(`/live/${id}/play`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  // RLS: الجلسة تظهر لطلاب صفها فقط، وهي مفتوحة
  const { data: ses } = await supabase.from('live_sessions').select('id, title, code, status, current, reveal, class_id').eq('id', id).maybeSingle();
  if (!ses) notFound();
  const [{ data: acts }, { data: me }] = await Promise.all([
    supabase.from('live_activities').select('id, idx, kind, prompt, options, image, item_id').eq('session_id', id).order('idx'),
    supabase.rpc('my_class'),
  ]);
  return <LivePlay session={ses as Session} activities={(acts ?? []) as Activity[]} me={(me as { pseudonym: string }[] | null)?.[0]?.pseudonym ?? ''} />;
}
