import 'server-only';
import { createClient } from './supabase/server';
import content from '../../content/mosaics.json';
import visuals from '../../content/visuals.media.json';

export type Mosaic = { id: string; slug: string; title_ar: string; summary_ar: string; image_path: string; credit: string; license: string;
  license_url: string | null; source_url: string; grid: number; item_id: string | null };
export type Step = { title: string; body: string; source: { citation: string; url: string } };

export async function listMosaics() {
  const supabase = await createClient();
  const { data } = await supabase.from('mosaics').select('id, slug, title_ar, summary_ar, image_path, credit, license, license_url, source_url, grid, item_id').order('sort');
  return (data ?? []) as Mosaic[];
}
export async function getMosaic(slug: string) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('mosaics').select('id, slug, title_ar, summary_ar, image_path, credit, license, license_url, source_url, grid, item_id').eq('slug', slug).maybeSingle();
  return data as Mosaic | null;
}
export const steps: Step[] = content.steps.map((st) => ({ title: st.title, body: st.body, source: content.sources.find((x) => x.key === st.source)! }));
const vm = visuals as unknown as Record<string, { width: number; height: number; blur: string }>;
export const dims = (path: string) => vm[path.split('/').pop()!.replace('.jpg', '')] ?? { width: 4, height: 3, blur: '' };
