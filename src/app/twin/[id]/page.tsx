import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { Mailbox, type Msg, type TwinInfo } from './Mailbox';

export const metadata: Metadata = { title: 'صندوق الرسائل' };

export default async function Twin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireViewer(`/twin/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: twins } = await supabase.rpc('my_twinnings');
  const t = ((twins ?? []) as TwinInfo[]).find((x) => x.id === id);
  if (!t) notFound();
  // RLS: المعتمد للطرفين، والمعلّق لكاتبه ومعلمه فقط
  const [{ data: msgs }, { data: mates }, { data: mine }] = await Promise.all([
    supabase.from('twin_messages').select('id, from_class, author_member, author_teacher, parent_id, kind, body, status, reject_reason, created_at, twin_media(id, kind, path, mime, width, height, seconds, alt)')
      .eq('twinning_id', id).order('created_at'),
    supabase.rpc('my_classmates', { p_class: t.mine }),
    supabase.rpc('my_class'),
  ]);
  const paths = (msgs ?? []).flatMap((m) => (m.twin_media as { path: string }[]).map((x) => x.path));
  const signed = paths.length ? (await supabase.storage.from('twin').createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((x) => [x.path, x.signedUrl]));
  const names = Object.fromEntries(((mates ?? []) as { member_id: string; pseudonym: string }[]).map((m) => [m.member_id, m.pseudonym]));
  const list: Msg[] = (msgs ?? []).map((m) => ({
    id: m.id, mine: m.from_class === t.mine, parent: m.parent_id, kind: m.kind as Msg['kind'], body: m.body, status: m.status as Msg['status'], reason: m.reject_reason,
    at: m.created_at, by: m.author_teacher ? 'المعلم' : m.from_class === t.mine ? (names[m.author_member ?? ''] ?? 'طالب من صفنا') : `طالب من ${t.their_school}`,
    media: (m.twin_media as { id: string; kind: 'image' | 'audio'; path: string; width: number | null; height: number | null; alt: string | null }[])
      .map((x) => ({ id: x.id, kind: x.kind, url: url.get(x.path) ?? '', w: x.width, h: x.height, alt: x.alt })),
  }));
  const meMember = (mine as { member_id: string }[] | null)?.[0]?.member_id ?? null;
  return (
    <main>
      <p style={{ padding: 'var(--space-5) var(--gutter) 0', color: 'var(--ink-2)', fontSize: 'var(--step--1)' }}>
        <Link href={t.i_am_teacher ? `/teach/${t.mine}` : '/class'}>{t.i_am_teacher ? 'صفي' : 'صفي'}</Link> / صندوق الرسائل
      </p>
      <Mailbox twin={t} messages={list} isTeacher={t.i_am_teacher} meMember={meMember} />
    </main>
  );
}
