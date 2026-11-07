'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer, isStaff } from '@/lib/viewer';

const kinds = ['image', 'audio', 'video', 'document', 'text'] as const;
const trusts = ['official_document', 'personal_testimony', 'circulated_account', 'under_review'] as const;
const rights = ['public_domain', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'permission', 'all_rights_reserved', 'unknown'] as const;
const statuses = ['draft', 'in_review', 'verified', 'published', 'rejected', 'archived'] as const;

const opt = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional();
const optInt = z.string().trim().transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= -2_600_000 && v <= 2100)).nullable().optional();

const base = z.object({
  kind: z.enum(kinds),
  title_ar: z.string().trim().min(2).max(300),
  title_en: opt(300),
  summary_ar: opt(2000),
  body_ar: opt(50_000),
  year_start: optInt,
  year_end: optInt,
  contributor_public_name: opt(80),
  rights_holder: opt(300),
  rights_note: opt(1000),
});
const staffFields = z.object({
  trust: z.enum(trusts), rights: z.enum(rights),
  is_event: z.literal('on').optional().transform((v) => v === 'on'),
  date_exact: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().transform((v) => v || null),
}).transform((v) => ({ ...v, date_precision: v.date_exact ? ('day' as const) : null }));

const where = (form: FormData) => (form.get('return') === 'admin' ? '/admin/items' : '/studio/items');
const fail = (path: string, msg?: string) => redirect(`${path}?error=${encodeURIComponent(msg ?? '')}`);

export async function createItem(form: FormData) {
  const parsed = base.safeParse(Object.fromEntries(form));
  const back = form.get('return') === 'admin' ? '/admin/items/new' : '/studio/new';
  if (!parsed.success) fail(back, 'violates check constraint');
  const v = await getViewer();
  if (!v) redirect('/signin');
  const supabase = await createClient();
  const { data, error } = await supabase.from('items')
    .insert({ ...parsed.data!, contributor_id: v.id }).select('id').single();
  if (error) fail(back, error.message);
  redirect(`${where(form)}/${data!.id}?ok=created`);
}

export async function updateItem(id: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const v = await getViewer();
  const raw = Object.fromEntries(form);
  const b = base.safeParse(raw), st = isStaff(v) ? staffFields.safeParse(raw) : null;
  const parsed = b.success && (!st || st.success) ? { success: true as const, data: { ...b.data, ...(st?.success ? st.data : {}) } } : { success: false as const, data: null };
  if (!parsed.success) fail(path, 'violates check constraint');
  const supabase = await createClient();
  const { data, error } = await supabase.from('items').update(parsed.data!).eq('id', id).select('id');
  if (error) fail(path, error.message);
  if (!data?.length) fail(path, 'not allowed');
  revalidatePath(path);
  redirect(`${path}?ok=saved`);
}

export async function addSource(id: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const parsed = z.object({
    kind: z.enum(['archive', 'publication', 'person', 'institution', 'web', 'other']),
    citation: z.string().trim().min(3).max(1000),
    url: z.string().trim().url().startsWith('http').max(1000).or(z.literal('')).transform((u) => u || null),
    archive_ref: opt(300),
    locator: opt(300),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) fail(path, 'violates check constraint');
  const { locator, ...src } = parsed.data!;
  const supabase = await createClient();
  const v = await getViewer();
  const { data: s, error } = await supabase.from('sources').insert({ ...src, created_by: v?.id }).select('id').single();
  if (error) fail(path, error.message);
  const { error: e2 } = await supabase.from('item_sources').insert({ item_id: id, source_id: s!.id, locator });
  if (e2) fail(path, e2.message);
  redirect(`${path}?ok=source`);
}

export async function removeSource(id: string, sourceId: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const supabase = await createClient();
  const { error } = await supabase.from('item_sources').delete().eq('item_id', id).eq('source_id', sourceId);
  if (error) fail(path, error.message);
  redirect(`${path}?ok=saved`);
}

export async function transition(id: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const to = z.enum(statuses).safeParse(form.get('to'));
  if (!to.success) fail(path);
  const reason = String(form.get('reason') ?? '').trim().slice(0, 1000) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_status', { p_item: id, p_to: to.data!, p_reason: reason });
  if (error) fail(path, error.message);
  revalidatePath('/admin', 'layout');
  redirect(`${path}?ok=transitioned`);
}

export async function addConsent(id: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const parsed = z.object({
    subject_name_private: z.string().trim().min(2).max(120),
    method: z.enum(['in_app_signature', 'recorded_verbal', 'paper_scan']),
    agree: z.literal('on'),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) fail(path, 'violates check constraint');
  const v = await getViewer();
  const supabase = await createClient();
  const { CONSENT_TEXT, CONSENT_VERSION } = await import('@/lib/consent');
  const { error } = await supabase.from('consents').insert({
    item_id: id, given_by: v?.id, subject_name_private: parsed.data!.subject_name_private,
    method: parsed.data!.method, consent_text: CONSENT_TEXT, consent_text_version: CONSENT_VERSION,
  });
  if (error) fail(path, error.message);
  redirect(`${path}?ok=consent`);
}

export async function withdrawConsent(id: string, consentId: string, form: FormData) {
  const path = `${where(form)}/${id}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_consent', {
    p_consent: consentId, p_reason: String(form.get('reason') ?? '').slice(0, 500) || null,
  });
  if (error) fail(path, error.message);
  redirect(`${path}?ok=withdrawn`);
}

export async function restoreVersion(id: string, versionId: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_restore_version', { p_version: versionId });
  if (error) fail(`/admin/items/${id}`, error.message);
  redirect(`/admin/items/${id}?ok=restored`);
}
