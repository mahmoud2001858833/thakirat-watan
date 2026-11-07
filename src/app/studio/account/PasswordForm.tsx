'use client';
import { useActionState } from 'react';
import { setPassword, type SignInState } from '@/app/signin/actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, { status: 'idle' } as SignInState);
  return (
    <form action={action}>
      {state.status === 'sent' && <p role="status" className="notice notice-ok">حُفظت كلمة المرور. تستطيع الدخول بها من الآن.</p>}
      {state.status === 'error' && <p role="alert" className="notice notice-error">تأكد أن الكلمتين متطابقتان وأن طولها عشرة أحرف على الأقل.</p>}
      {state.status === 'rate' && <p role="alert" className="notice notice-error">محاولات كثيرة. انتظر قليلاً.</p>}
      <div className="field"><label htmlFor="pw">كلمة المرور الجديدة</label><input id="pw" name="password" type="password" autoComplete="new-password" minLength={10} required dir="ltr" /></div>
      <div className="field"><label htmlFor="pw2">أعد كتابتها</label><input id="pw2" name="confirm" type="password" autoComplete="new-password" minLength={10} required dir="ltr" /></div>
      <button className="btn btn-primary" disabled={pending}>احفظ كلمة المرور</button>
    </form>
  );
}
