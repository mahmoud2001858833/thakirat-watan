'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireStaff } from '@/lib/viewer';

const back = (p: string, m?: string) => redirect(`${p}?${m ? `error=${encodeURIComponent(m)}` : 'ok=saved'}`);

export async function reviewLeaf(id: string, form: FormData) {
  await requireStaff();
  const approve = form.get('decision') === 'approve';
  const reason = String(form.get('reason') ?? '').trim().slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase.rpc('review_leaf', { p_leaf: id, p_approve: approve, p_reason: reason || null });
  revalidatePath('/olive');
  back('/admin/olive', error?.message);
}

export async function purgeDemo() {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_purge_demo');
  revalidatePath('/', 'layout');
  back('/admin/olive', error?.message);
}

export async function toggleMosaic(id: string, published: boolean) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from('mosaics').update({ published }).eq('id', id);
  revalidatePath('/restoration', 'layout');
  back('/admin/mosaics', error?.message);
}

export async function saveLetterNote(id: number, form: FormData) {
  await requireStaff();
  const note = z.string().trim().max(500).parse(String(form.get('note') ?? ''));
  const supabase = await createClient();
  const { error } = await supabase.from('script_letters').update({ note_ar: note || null }).eq('id', id);
  revalidatePath('/write-name');
  back('/admin/scripts', error?.message);
}
