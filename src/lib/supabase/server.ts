import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

/** عميل Supabase للخادم يحمل جلسة المستخدم — RLS تُطبَّق دائماً. لا يوجد مفتاح service role في التطبيق. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // يُستدعى من Server Component — الـproxy يجدد الجلسة
        }
      },
    },
  });
}
