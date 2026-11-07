import type { Metadata } from 'next';
import { requireViewer } from '@/lib/viewer';
import { PasswordForm } from './PasswordForm';

export const metadata: Metadata = { title: 'حسابي' };

export default async function Account() {
  const v = await requireViewer('/studio/account');
  return (
    <main className="page">
      <div className="page-head"><div><h1>حسابي</h1><p dir="ltr" style={{ textAlign: 'end' }}>{v.email}</p></div></div>
      <section style={{ maxWidth: '32rem' }} aria-labelledby="pw-h">
        <h2 id="pw-h" style={{ fontSize: 'var(--step-2)' }}>كلمة المرور</h2>
        <p>عيّن كلمة مرور لتدخل بها مباشرة دون انتظار رسالة البريد. عشرة أحرف على الأقل.</p>
        <PasswordForm />
      </section>
    </main>
  );
}
