import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const raw = searchParams.get('next') ?? '/studio';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/studio';
  if (searchParams.get('error')) return NextResponse.redirect(`${origin}/signin?error=expired`);
  const supabase = await createClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };

  if (error) return NextResponse.redirect(`${origin}/signin?error=callback`);
  return NextResponse.redirect(`${origin}${next}`);
}
