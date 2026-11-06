import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;
  // فحص متفائل فقط؛ الصلاحية الحقيقية في الصفحة وفي RLS
  if (!signedIn && (path.startsWith('/admin') || path.startsWith('/studio'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return response;
}
