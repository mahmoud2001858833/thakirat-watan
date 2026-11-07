import 'server-only';
import { createClient } from './supabase/server';
import { MEDIA_COLS, type Media } from './media';

export type ArchiveItem = {
  id: string; kind: string; title_ar: string; summary_ar: string | null; trust: 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review';
  rights: string; rights_holder: string | null; rights_note: string | null; year_start: number | null; year_end: number | null;
  place_id: string | null; period_id: string | null; provenance: string; is_demo: boolean; date_exact: string | null;
  places?: { name_ar: string; key: string } | null; periods?: { name_ar: string; key: string } | null;
  item_media?: Media[];
};
const SELECT = `id, kind, title_ar, summary_ar, trust, rights, rights_holder, rights_note, year_start, year_end, place_id, period_id, provenance, is_demo, date_exact,
  places(name_ar, key), periods(name_ar, key), item_media(${MEDIA_COLS})`;

export type Filters = { q?: string; place?: string; trust?: string; era?: string; kind?: string };

export async function listArchive(f: Filters, limit = 60) {
  const supabase = await createClient();
  let ids: string[] | null = null;
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    const { data } = await supabase.rpc('search_items', { q, p_limit: 100 });
    ids = (data ?? []).filter((x: { is_event: boolean }) => !x.is_event).map((x: { id: string }) => x.id);
    if (!ids!.length) return [];
  }
  const sel = SELECT
    .replace('places(name_ar, key)', f.place ? 'places!inner(name_ar, key)' : 'places(name_ar, key)')
    .replace('periods(name_ar, key)', f.era ? 'periods!inner(name_ar, key)' : 'periods(name_ar, key)');
  let query = supabase.from('items').select(sel).eq('status', 'published').eq('is_event', false);
  if (ids) query = query.in('id', ids);
  if (f.place) query = query.eq('places.key', f.place);
  if (f.era) query = query.eq('periods.key', f.era);
  if (f.trust && ['official_document', 'personal_testimony', 'circulated_account', 'under_review'].includes(f.trust)) query = query.eq('trust', f.trust);
  if (f.kind && ['image', 'audio', 'video', 'document', 'text'].includes(f.kind)) query = query.eq('kind', f.kind);
  const { data, error } = await query.order('featured', { ascending: false }).order('year_start', { ascending: true, nullsFirst: false }).limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArchiveItem[];
  // ترتيب نتائج البحث بحسب الصلة
  return ids ? rows.sort((a, b) => ids!.indexOf(a.id) - ids!.indexOf(b.id)) : rows;
}

export async function getArchiveItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: item }, { data: srcs }] = await Promise.all([
    supabase.from('items').select(SELECT).eq('id', id).eq('status', 'published').maybeSingle(),
    supabase.from('item_sources').select('locator, sources(id, kind, citation, url)').eq('item_id', id),
  ]);
  if (!item) return null;
  return { item: item as unknown as ArchiveItem, sources: (srcs ?? []) as unknown as { locator: string | null; sources: { id: string; kind: string; citation: string; url: string | null } }[] };
}

export async function facets() {
  const supabase = await createClient();
  const [{ data: places }, { data: periods }] = await Promise.all([
    supabase.from('places').select('key, name_ar').eq('kind', 'governorate').order('name_ar'),
    supabase.from('periods').select('key, name_ar, start_year').order('start_year'),
  ]);
  return { places: places ?? [], periods: periods ?? [] };
}

export const yearLabel = (a: number | null, b: number | null) => {
  const f = (y: number) => (y < 0 ? `${new Intl.NumberFormat('ar-JO-u-nu-arab').format(-y)} ق.م` : `${new Intl.NumberFormat('ar-JO-u-nu-arab', { useGrouping: false }).format(y)}م`);
  if (a == null && b == null) return null;
  if (a != null && b != null && a !== b) return `${f(a)} – ${f(b)}`;
  return f((a ?? b)!);
};
