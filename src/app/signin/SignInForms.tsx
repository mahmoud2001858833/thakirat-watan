'use client';
import { useActionState, useState } from 'react';
import { sendMagicLink, signInWithPassword, type SignInState } from './actions';

type T = {
  email: string; send: string; sent: string; password: string; usePassword: string;
  signInPassword: string; error: string; rateLimited: string;
};

const initial: SignInState = { status: 'idle' };

function Status({ state, t }: { state: SignInState; t: T }) {
  if (state.status === 'sent') return <p role="status" className="notice notice-ok">{t.sent}</p>;
  if (state.status === 'error') return <p role="alert" className="notice notice-error">{t.error}</p>;
  if (state.status === 'rate') return <p role="alert" className="notice notice-error">{t.rateLimited}</p>;
  return null;
}

export function SignInForms({ t, next }: { t: T; next: string }) {
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, initial);
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, initial);

  return mode === 'link' ? (
    <form action={linkAction} noValidate={false}>
      <Status state={linkState} t={t} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">{t.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required dir="ltr" />
      </div>
      <button className="btn btn-primary" disabled={linkPending}>{t.send}</button>
      <button type="button" className="btn btn-quiet" onClick={() => setMode('password')}>{t.usePassword}</button>
    </form>
  ) : (
    <form action={pwAction}>
      <Status state={pwState} t={t} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email2">{t.email}</label>
        <input id="email2" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>
      <div className="field">
        <label htmlFor="password">{t.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required dir="ltr" />
      </div>
      <button className="btn btn-primary" disabled={pwPending}>{t.signInPassword}</button>
      <button type="button" className="btn btn-quiet" onClick={() => setMode('link')}>{t.send}</button>
    </form>
  );
}
