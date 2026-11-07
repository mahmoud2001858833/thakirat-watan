'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireStaff } from '@/lib/viewer';

const roles = ['admin', 'reviewer', 'school_admin', 'teacher', 'contributor'] as const;
const fail = (p: string, m?: string) => redirect(`${p}?error=${encodeURIComponent(m ?? '')}`);

export async function grantRole(form: FormData) {
  const v = await requireAdmin();
  const p = z.object({
    user_id: z.string().uuid(), role: z.enum(roles),
    school_id: z.string().uuid().or(z.literal('')).transform((x) => x || null),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) fail('/admin/users', 'violates check constraint');
  const supabase = await createClient();
  const { error } = await supabase.from('user_roles').insert({ ...p.data!, granted_by: v.id });
  if (error) fail('/admin/users', error.message);
  redirect('/admin/users?ok=granted');
}

export async function revokeRole(roleId: number) {
  const v = await requireAdmin();
  const supabase = await createClient();
  // لا يسحب المدير دور «مدير» من نفسه حتى لا تبقى المنصة بلا مدير
  const { data: r } = await supabase.from('user_roles').select('user_id, role').eq('id', roleId).single();
  if (r?.user_id === v.id && r.role === 'admin') fail('/admin/users', 'not allowed');
  const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
  if (error) fail('/admin/users', error.message);
  redirect('/admin/users?ok=revoked');
}

export async function createSchool(form: FormData) {
  await requireAdmin();
  const p = z.object({ name: z.string().trim().min(2).max(200), public_listing: z.literal('on').optional(), place_id: z.string().uuid() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) fail('/admin/schools', 'violates check constraint');
  const supabase = await createClient();
  const { error } = await supabase.from('schools').insert({ name: p.data!.name, public_listing: p.data!.public_listing === 'on', place_id: p.data!.place_id });
  if (error) fail('/admin/schools', error.message);
  redirect('/admin/schools?ok=school');
}

export async function setSetting(form: FormData) {
  const v = await requireAdmin();
  const key = z.enum(['assistant.enabled']).safeParse(form.get('key'));
  if (!key.success) fail('/admin/settings');
  const value = form.get('value') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.from('settings')
    .update({ value, updated_by: v.id, updated_at: new Date().toISOString() }).eq('key', key.data!);
  if (error) fail('/admin/settings', error.message);
  revalidatePath('/', 'layout');
  redirect('/admin/settings?ok=settings');
}

export async function handleReport(id: string, form: FormData) {
  const v = await requireStaff();
  const status = z.enum(['resolved', 'dismissed']).safeParse(form.get('status'));
  if (!status.success) fail('/admin/reports');
  const supabase = await createClient();
  const { error } = await supabase.from('reports')
    .update({ status: status.data!, handled_by: v.id, handled_at: new Date().toISOString() }).eq('id', id);
  if (error) fail('/admin/reports', error.message);
  redirect('/admin/reports?ok=report');
}
