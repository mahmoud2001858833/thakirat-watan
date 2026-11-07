'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

export type LeafState = { status: 'idle' | 'error' | 'rate' | 'auth'; message?: string };

export async function plantLeaf(_: LeafState, form: FormData): Promise<LeafState> {
  const v = await getViewer();
  if (!v) return { status: 'auth' };
  const p = z.object({
    body: z.string().trim().min(2).max(280),
    governorate_id: z.string().uuid(),
    display_name: z.string().trim().max(40).optional(),
  }).safeParse({ body: form.get('body'), governorate_id: form.get('governorate_id'), display_name: form.get('display_name') || undefined });
  if (!p.success) return { status: 'error', message: 'اكتب ذكرى من حرفين إلى 280 حرفاً، واختر محافظتك.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('olive_leaves').insert({ ...p.data, author_id: v.id }).select('id').single();
  if (error) return /too many/.test(error.message) ? { status: 'rate' } : { status: 'error', message: 'تعذّر حفظ الورقة. حاول مرة أخرى.' };
  revalidatePath('/olive');
  redirect(`/olive?planted=${data.id}`);
}
