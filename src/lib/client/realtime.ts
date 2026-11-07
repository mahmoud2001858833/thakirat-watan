'use client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/** يفتح قناة Realtime بعد تحميل جلسة المستخدم، حتى تُطبَّق RLS بهويته لا بهوية الزائر.
 *  يعيد دالة إغلاق. */
export function openChannel(sb: SupabaseClient, build: (sb: SupabaseClient) => RealtimeChannel) {
  let ch: RealtimeChannel | null = null, stop = false;
  (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) await sb.realtime.setAuth(data.session.access_token);
    if (!stop) ch = build(sb);
  })();
  return () => { stop = true; if (ch) sb.removeChannel(ch); };
}
