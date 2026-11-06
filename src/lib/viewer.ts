import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Role = 'admin' | 'reviewer' | 'school_admin' | 'teacher' | 'student' | 'contributor';
export type Viewer = { id: string; email: string | null; roles: { role: Role; school_id: string | null }[] };

/** المستخدم الحالي وأدواره — الأدوار تُقرأ من الجدول (عبر RLS)، لا من بيانات الـJWT. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const { data: roles } = await supabase.from('user_roles').select('role, school_id').eq('user_id', sub);
  return { id: sub, email: (data.claims.email as string) ?? null, roles: (roles ?? []) as Viewer['roles'] };
});

export const hasRole = (v: Viewer | null, ...r: Role[]) => !!v?.roles.some((x) => r.includes(x.role));
export const isStaff = (v: Viewer | null) => hasRole(v, 'admin', 'reviewer');

export async function requireViewer(next = '/') {
  const v = await getViewer();
  if (!v) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return v;
}

export async function requireStaff() {
  const v = await requireViewer('/admin');
  if (!isStaff(v)) redirect('/?denied=1');
  return v;
}

export async function requireAdmin() {
  const v = await requireViewer('/admin');
  if (!hasRole(v, 'admin')) redirect('/admin?denied=1');
  return v;
}
