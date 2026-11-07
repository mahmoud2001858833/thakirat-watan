'use client';
import { useActionState } from 'react';
import { studentSignIn, type CodeState } from '@/lib/actions/classroom';

/** دخول الطالب برمز من معلمه: لا بريد ولا كلمة سر يختارها */
export function StudentForm({ open }: { open: boolean }) {
  const [st, action, pending] = useActionState(studentSignIn, { status: 'idle' } as CodeState);
  return (
    <details open={open} style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--line)', paddingTop: 'var(--space-4)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>أنا طالب: معي رمز من معلمي</summary>
      <form action={action} style={{ marginTop: 'var(--space-3)' }}>
        {st.status === 'error' && <p role="alert" className="notice notice-error">الرمز غير صحيح. اكتبه كما على بطاقتك، مثل K7Q2M-9XAPDR.</p>}
        {st.status === 'rate' && <p role="alert" className="notice notice-error">محاولات كثيرة. انتظر قليلاً.</p>}
        <div className="field">
          <label htmlFor="scode">رمز الدخول</label>
          <input id="scode" name="code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required dir="ltr"
            placeholder="XXXXX-XXXXXX" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '1.3rem', letterSpacing: '.08em' }} />
        </div>
        <button className="btn btn-primary" disabled={pending}>ادخل إلى صفي</button>
      </form>
    </details>
  );
}
