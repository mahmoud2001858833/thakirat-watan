'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type SignInState = { status: 'idle' | 'sent' | 'error' | 'rate'; } ;

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/studio');

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL && !process.env.VERCEL_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}

export async function sendMagicLink(_: SignInState, form: FormData): Promise<SignInState> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get('email'));
  if (!email.success) return { status: 'error' };
  const next = safeNext(form.get('next'));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: error.status === 429 ? 'rate' : 'error' };
  return { status: 'sent' };
}

export async function signInWithPassword(_: SignInState, form: FormData): Promise<SignInState> {
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(200),
  }).safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { status: 'error' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: error.status === 429 ? 'rate' : 'error' };
  redirect(safeNext(form.get('next')));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
