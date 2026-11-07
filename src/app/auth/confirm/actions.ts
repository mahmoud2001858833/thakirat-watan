'use server';
import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const types: EmailOtpType[] = ['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change'];
const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/studio');

/** يُستدعى بضغطة زر لا بفتح الرابط، حتى لا تستهلك برامج فحص الروابط في البريد الرمز قبل صاحبه */
export async function confirmLink(form: FormData) {
  const token_hash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? 'email') as EmailOtpType;
  const next = safeNext(form.get('next'));
  if (!/^[a-zA-Z0-9_-]{20,128}$/.test(token_hash) || !types.includes(type)) redirect('/signin?error=link');
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) redirect(`/signin?error=${error.code === 'otp_expired' ? 'expired' : 'link'}`);
  redirect(next);
}
