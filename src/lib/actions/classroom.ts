'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer, hasRole } from '@/lib/viewer';

const uuid = z.string().uuid();
const studentEmail = (handle: string) => `s-${handle.toLowerCase()}@students.thakirat-watan.example`;

// ───────── دخول الطالب برمز من معلمه (لا بريد) ─────────
export type CodeState = { status: 'idle' | 'error' | 'rate' };
export async function studentSignIn(_: CodeState, form: FormData): Promise<CodeState> {
  const raw = String(form.get('code') ?? '').toUpperCase().replace(/[\s_–—]/g, '').replace(/^([A-Z0-9]{5})-?([A-Z0-9]{6})$/, '$1-$2');
  if (!/^[A-Z2-9]{5}-[A-Z2-9]{6}$/.test(raw)) return { status: 'error' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: studentEmail(raw.slice(0, 5)), password: raw });
  if (error) return { status: error.status === 429 ? 'rate' : 'error' };
  redirect('/class');
}

async function teacher() {
  const v = await getViewer();
  if (!v || !hasRole(v, 'teacher')) redirect('/teach?denied=1');
  return v;
}

// ───────── الصفوف والطلاب ─────────
export async function createClass(form: FormData) {
  const v = await teacher();
  const p = z.object({ name: z.string().trim().min(1).max(80), grade: z.coerce.number().int().min(1).max(12).optional(), school_id: uuid })
    .safeParse({ name: form.get('name'), grade: form.get('grade') || undefined, school_id: form.get('school_id') });
  if (!p.success || !v.roles.some((r) => r.role === 'teacher' && r.school_id === p.data.school_id)) redirect('/teach?error=class');
  const supabase = await createClient();
  const { data, error } = await supabase.from('classes').insert({ ...p.data, teacher_id: v.id }).select('id').single();
  if (error) redirect('/teach?error=class');
  redirect(`/teach/${data.id}`);
}

export type AddState = { status: 'idle' | 'ok' | 'error'; codes?: { pseudonym: string; code: string }[]; message?: string };
export async function addStudents(classId: string, _: AddState, form: FormData): Promise<AddState> {
  await teacher();
  const names = String(form.get('names') ?? '').split(/\n|،|,/).map((x) => x.trim()).filter(Boolean);
  if (!uuid.safeParse(classId).success || !names.length || names.length > 60) return { status: 'error', message: 'اكتب من اسم واحد إلى ستين اسماً، كل اسم في سطر.' };
  if (names.some((n) => n.length < 2 || n.length > 40)) return { status: 'error', message: 'كل اسم مستعار بين حرفين وأربعين حرفاً.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('teacher_add_students', { p_class: classId, p_pseudonyms: names });
  if (error) return { status: 'error', message: /full/.test(error.message) ? 'الصف ممتلئ (ستون طالباً).' : 'تعذّرت الإضافة. تأكد من الأسماء وحاول مرة أخرى.' };
  revalidatePath(`/teach/${classId}`);
  return { status: 'ok', codes: (data as { pseudonym: string; code: string }[]).map(({ pseudonym, code }) => ({ pseudonym, code })) };
}

export async function resetStudentCode(memberId: string) {
  await teacher();
  if (!uuid.safeParse(memberId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('teacher_reset_code', { p_member: memberId });
  return error ? null : (data as string);
}

export async function removeStudent(classId: string, memberId: string) {
  await teacher();
  if (!uuid.safeParse(memberId).success) return;
  const supabase = await createClient();
  await supabase.rpc('teacher_remove_student', { p_member: memberId });
  revalidatePath(`/teach/${classId}`);
}

// ───────── التوأمة ─────────
export async function setTwinOpen(classId: string, open: boolean) {
  await teacher();
  const supabase = await createClient();
  await supabase.from('classes').update({ open_for_twinning: open }).eq('id', classId);
  revalidatePath(`/teach/${classId}`);
}
export async function proposeTwin(mine: string, theirs: string) {
  await teacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc('twin_propose', { p_mine: mine, p_theirs: theirs });
  redirect(`/teach/${mine}?${error ? `error=${/governorate/.test(error.message) ? 'samegov' : 'twin'}` : 'ok=proposed'}#twin`);
}
export async function respondTwin(classId: string, twinId: string, accept: boolean) {
  await teacher();
  const supabase = await createClient();
  await supabase.rpc('twin_respond', { p_twin: twinId, p_accept: accept });
  redirect(accept ? `/twin/${twinId}` : `/teach/${classId}#twin`);
}

// ───────── صندوق الرسائل ─────────
export type PostState = { status: 'idle' | 'ok' | 'error'; message?: string };
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isWebp = (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
/** هل في JPEG مقطع EXIF (قد يحوي الموقع)؟ المتصفح يعيد ترميز الصورة قبل الرفع فيُزيله، ونرفض ما بقي فيه */
function jpegHasExif(b: Uint8Array) {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xe1 && String.fromCharCode(...b.slice(i + 4, i + 8)) === 'Exif') return true;
    if (marker === 0xda) break;
    i += 2 + len;
  }
  return false;
}
function audioKind(b: Uint8Array): [string, string] | null {
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ['audio/webm', 'webm'];
  if (String.fromCharCode(...b.slice(0, 4)) === 'OggS') return ['audio/ogg', 'ogg'];
  if (String.fromCharCode(...b.slice(4, 8)) === 'ftyp') return ['audio/mp4', 'm4a'];
  if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return ['audio/mpeg', 'mp3'];
  return null;
}

export async function postTwin(twinId: string, _: PostState, form: FormData): Promise<PostState> {
  const v = await getViewer();
  if (!v) return { status: 'error', message: 'ادخل أولاً.' };
  const p = z.object({ kind: z.enum(['question', 'answer']), body: z.string().trim().min(2).max(1200), parent: uuid.optional() })
    .safeParse({ kind: form.get('kind'), body: form.get('body'), parent: form.get('parent') || undefined });
  if (!p.success || !uuid.safeParse(twinId).success) return { status: 'error', message: 'اكتب رسالة من حرفين إلى 1200 حرف.' };
  const files = form.getAll('media').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
  // تحقق كامل قبل إنشاء الرسالة
  const checked: { kind: 'image' | 'audio'; mime: string; ext: string; buf: Uint8Array; w?: number; h?: number; sec?: number }[] = [];
  for (const [i, f] of files.entries()) {
    if (f.size > 3_500_000) return { status: 'error', message: 'الملف كبير. الصور تُضغط تلقائياً، والتسجيل حتى ثلاث دقائق.' };
    const buf = new Uint8Array(await f.arrayBuffer());
    if (isJpeg(buf) || isWebp(buf)) {
      if (isJpeg(buf) && jpegHasExif(buf)) return { status: 'error', message: 'الصورة تحمل بيانات موقع. أعد اختيارها من الصفحة نفسها.' };
      checked.push({ kind: 'image', mime: isJpeg(buf) ? 'image/jpeg' : 'image/webp', ext: isJpeg(buf) ? 'jpg' : 'webp', buf,
        w: Number(form.get(`w${i}`)) || undefined, h: Number(form.get(`h${i}`)) || undefined });
    } else {
      const a = audioKind(buf);
      if (!a) return { status: 'error', message: 'نقبل الصور (JPEG/WebP) والتسجيلات الصوتية فقط.' };
      const sec = Number(form.get(`s${i}`)) || undefined;
      if (sec && sec > 180) return { status: 'error', message: 'التسجيل حتى ثلاث دقائق.' };
      checked.push({ kind: 'audio', mime: a[0], ext: a[1], buf, sec });
    }
  }
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('twin_post', { p_twin: twinId, p_kind: p.data.kind, p_body: p.data.body, p_parent: p.data.parent ?? null });
  if (error) return { status: 'error', message: /too many/.test(error.message) ? 'وصلت إلى حد الرسائل اليوم.' : 'تعذّر الإرسال.' };
  for (const c of checked) {
    const path = `${twinId}/${id}/${crypto.randomUUID()}.${c.ext}`;
    const up = await supabase.storage.from('twin').upload(path, c.buf, { contentType: c.mime, upsert: false });
    if (up.error) return { status: 'error', message: 'وصلت الرسالة، وتعذّر رفع أحد الملفات.' };
    await supabase.rpc('twin_attach', { p_msg: id, p_kind: c.kind, p_path: path, p_mime: c.mime, p_bytes: c.buf.length, p_w: c.w ?? null, p_h: c.h ?? null, p_seconds: c.sec ?? null, p_alt: String(form.get('alt') ?? '').slice(0, 200) || null });
  }
  revalidatePath(`/twin/${twinId}`);
  return { status: 'ok', message: hasRole(v, 'student') ? 'وصلت رسالتك إلى معلمك. يراها الصف التوأم بعد موافقته.' : 'أُرسلت الرسالة.' };
}

export async function reviewTwin(twinId: string, msgId: string, approve: boolean, reason?: string) {
  await teacher();
  const supabase = await createClient();
  await supabase.rpc('twin_review', { p_msg: msgId, p_approve: approve, p_reason: reason ?? null });
  revalidatePath(`/twin/${twinId}`);
}

// ───────── الجلسة المباشرة ─────────
export type JoinState = { status: 'idle' | 'error' | 'auth' };
export async function joinLive(_: JoinState, form: FormData): Promise<JoinState> {
  const code = String(form.get('code') ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
  if (code.length !== 6) return { status: 'error' };
  const v = await getViewer();
  if (!v) return { status: 'auth' };
  const supabase = await createClient();
  const { data } = await supabase.rpc('live_join', { p_code: code });
  if (!data) return { status: 'error' };
  redirect(`/live/${data}/play`);
}

const ACT = z.array(z.object({
  kind: z.enum(['poll', 'text', 'pin']), prompt: z.string().trim().min(2).max(300),
  options: z.array(z.string().trim().min(1).max(80)).max(6).default([]), item_id: uuid.nullable().optional(), image: z.string().regex(/^\/media\/[a-z0-9/_-]+\.jpg$/).nullable().optional(),
})).min(1).max(20);

export async function openLive(classId: string, title: string, activitiesJson: string) {
  await teacher();
  const acts = ACT.safeParse(JSON.parse(activitiesJson || '[]'));
  if (!uuid.safeParse(classId).success || !acts.success) return { error: 'تحقق من الأسئلة.' };
  for (const a of acts.data) if (a.kind === 'poll' && a.options.length < 2) return { error: 'سؤال التصويت يحتاج خيارين على الأقل.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('live_open', { p_class: classId, p_title: title.slice(0, 120) });
  if (error || !data?.[0]) return { error: 'تعذّر فتح الجلسة.' };
  const sid = data[0].id as string;
  const { error: e2 } = await supabase.from('live_activities').insert(acts.data.map((a, idx) => ({ session_id: sid, idx, kind: a.kind, prompt: a.prompt, options: a.options, item_id: a.item_id ?? null, image: a.image ?? null })));
  if (e2) return { error: 'تعذّر حفظ الأسئلة.' };
  redirect(`/live/${sid}`);
}

// ───────── الفسيفساء الكبرى ─────────
export async function claimGrand(classId: string, slug: string) {
  await teacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('grand_claim', { p_slug: slug, p_class: classId });
  if (error) redirect(`/teach/${classId}?error=grand#grand`);
  redirect(`/grand/${data}`);
}
