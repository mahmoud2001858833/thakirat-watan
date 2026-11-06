import type { Metadata } from 'next';
import { getDict, fmtDate } from '@/i18n';
import { requireAdmin } from '@/lib/viewer';
import { createClient } from '@/lib/supabase/server';
import { grantRole, revokeRole } from '@/lib/actions/admin';
import { Flash } from '@/components/Flash';
import s from '../admin.module.css';

export const metadata: Metadata = { title: 'المستخدمون والأدوار' };
type U = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; is_minor: boolean;
  roles: { id: number; role: keyof ReturnType<typeof getDict>['role']; school: string | null }[] };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  await requireAdmin();
  const t = getDict();
  const { q = '', ok, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: users, error: e }, { data: schools }] = await Promise.all([
    supabase.rpc('admin_list_users', { p_query: q.slice(0, 100) || null, p_limit: 100 }),
    supabase.from('schools').select('id, name').order('name'),
  ]);
  return (
    <main className="page">
      <div className="page-head"><div><h1>المستخدمون والأدوار</h1><p>الطلاب يظهرون بلا بريد. أي منح أو سحب يُسجَّل في سجل التدقيق.</p></div></div>
      <Flash ok={ok} error={error ?? (e ? e.message : undefined)} />
      <form className={s.inline} role="search" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="field"><label htmlFor="q">ابحث بالبريد</label><input id="q" name="q" type="search" defaultValue={q} dir="ltr" /></div>
        <button className="btn">ابحث</button>
      </form>
      <div className="ledger-wrap">
        <table className="ledger">
          <thead><tr><th scope="col">المستخدم</th><th scope="col">الأدوار</th><th scope="col">آخر دخول</th><th scope="col">منح دور</th></tr></thead>
          <tbody>
            {((users ?? []) as U[]).map((u) => (
              <tr key={u.id}>
                <td dir="ltr" style={{ textAlign: 'end' }}>{u.email ?? <span className="hint">قاصر — البريد مخفي</span>}</td>
                <td>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {u.roles.map((r) => (
                      <li key={r.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {t.role[r.role]}{r.school && ` — ${r.school}`}
                        <form action={revokeRole.bind(null, r.id)}><button className="btn btn-quiet" aria-label={`اسحب دور ${t.role[r.role]}`}>اسحب</button></form>
                      </li>
                    ))}
                  </ul>
                </td>
                <td>{u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : '—'}</td>
                <td>
                  {!u.is_minor && (
                    <form action={grantRole} className={s.inline}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <div className="field">
                        <label htmlFor={`r-${u.id}`} className="sr-only">الدور</label>
                        <select id={`r-${u.id}`} name="role">
                          {(['reviewer', 'admin', 'school_admin', 'teacher', 'contributor'] as const).map((r) => <option key={r} value={r}>{t.role[r]}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`s-${u.id}`} className="sr-only">المدرسة</label>
                        <select id={`s-${u.id}`} name="school_id" defaultValue="">
                          <option value="">بلا مدرسة</option>
                          {schools?.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                        </select>
                      </div>
                      <button className="btn">امنح</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
