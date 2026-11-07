'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;
/** عميل المتصفح بالمفتاح العام — RLS هي الحارس */
export const browserClient = () => (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY));
