import type { Metadata } from 'next';
import { getDict } from '@/i18n';
import { SignInForms } from './SignInForms';
import s from './signin.module.css';

export const metadata: Metadata = { title: 'الدخول' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const t = getDict().auth;
  const { next = '/studio', error } = await searchParams;
  return (
    <main className={s.wrap}>
      <div className={`${s.panel} settle`}>
        <h1 className={s.title}>{t.title}</h1>
        <p className={s.lede}>{t.lede}</p>
        {error === 'callback' && <p role="alert" className="notice notice-error">{t.callbackError}</p>}
        <SignInForms t={t} next={next} />
      </div>
    </main>
  );
}
