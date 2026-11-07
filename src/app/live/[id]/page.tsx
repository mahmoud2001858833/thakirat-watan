import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Session } from '@/lib/live';
import { LiveConsole } from './LiveConsole';

export const metadata: Metadata = { title: 'الجلسة المباشرة' };

export default async function Live({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer(`/live/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: ses } = await supabase.from('live_sessions').select('id, title, code, status, current, reveal, class_id, teacher_id').eq('id', id).maybeSingle();
  if (!ses || ses.teacher_id !== v.id) notFound();
  const { data: acts } = await supabase.from('live_activities').select('id, idx, kind, prompt, options, image, item_id').eq('session_id', id).order('idx');
  const { count } = await supabase.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', ses.class_id);
  return <LiveConsole session={ses as Session} activities={(acts ?? []) as Activity[]} classSize={count ?? 0} />;
}
