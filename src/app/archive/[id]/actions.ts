'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function reportItem(itemId: string, form: FormData) {
  const p = z.object({ reason: z.enum(['inaccurate', 'rights', 'privacy', 'other']), details: z.string().trim().max(2000) })
    .safeParse({ reason: form.get('reason'), details: form.get('details') ?? '' });
  if (!p.success) redirect(`/archive/${itemId}`);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.from('reports').insert({ item_id: itemId, reason: p.data!.reason, details: p.data!.details || null, reporter_id: data?.claims?.sub ?? null });
  redirect(`/archive/${itemId}?reported=1`);
}
