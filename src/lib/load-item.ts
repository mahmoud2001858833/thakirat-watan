import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from './supabase/server';
import type { ConsentRow, EventRow, ItemRow, SourceLink } from '@/components/editor/types';

export async function loadItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: item }, { data: sources }, { data: consents }, { data: events }, { data: media }] = await Promise.all([
    supabase.from('items').select('*').eq('id', id).maybeSingle(),
    supabase.from('item_sources').select('locator, sources(id, kind, citation, url, archive_ref)').eq('item_id', id),
    supabase.from('consents').select('id, subject_name_private, method, consent_text_version, given_at, withdrawn_at').eq('item_id', id).order('given_at'),
    supabase.from('review_events').select('id, from_status, to_status, reason, at').eq('item_id', id).order('id', { ascending: false }),
    supabase.from('item_media').select('storage_path, external_url, width, height, alt_ar, blur, credit, license, license_url, source_url').eq('item_id', id).order('sort'),
  ]);
  if (!item) notFound();
  return {
    item: item as ItemRow,
    sources: (sources ?? []) as unknown as SourceLink[],
    consents: (consents ?? []) as ConsentRow[],
    events: (events ?? []) as EventRow[],
    media: (media ?? []) as import('./media').Media[],
  };
}
