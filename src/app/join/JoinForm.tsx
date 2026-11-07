'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { joinLive, type JoinState } from '@/lib/actions/classroom';

export function JoinForm() {
  const [st, action, pending] = useActionState(joinLive, { status: 'idle' } as JoinState);
  return (
    <form action={action}>
      {st.status === 'error' && <p role="alert" className="notice notice-error">لم نجد جلسة مفتوحة لصفك بهذا الرمز.</p>}
      {st.status === 'auth' && <p role="alert" className="notice notice-error">ادخل أولاً برمز الدخول من معلمك. <Link href="/signin?student=1&next=/join">الدخول</Link></p>}
      <div className="field">
        <label htmlFor="code">رمز الجلسة</label>
        <input id="code" name="code" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9٠-٩ ]{6,8}" required dir="ltr"
          style={{ fontSize: '2.2rem', letterSpacing: '.3em', textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace' }} />
      </div>
      <button className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>ادخل</button>
    </form>
  );
}
