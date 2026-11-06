import type { Metadata } from 'next';
import Link from 'next/link';
import { getDict } from '@/i18n';
import { MiniWindow } from '@/components/window/MiniWindow';
import { SignInForms } from './SignInForms';
import s from './signin.module.css';

export const metadata: Metadata = { title: 'الدخول' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const t = getDict().auth;
  const { next = '/studio', error } = await searchParams;
  return (
    <main className={s.wrap}>
      <div className={s.art}>
        <MiniWindow className={s.window} />
      </div>
      <div className={`${s.panel} settle`}>
        <p className={s.kicker}>{t.kicker}</p>
        <h1 className={s.title}>{t.title}</h1>
        <p className={s.lede}>{t.lede}</p>
        {error === 'callback' && <p role="alert" className="notice notice-error">{t.callbackError}</p>}
        <SignInForms t={t} next={next} />
        <div className={s.fine}><p>{t.fine}</p><Link href="/">{t.back}</Link></div>
      </div>
    </main>
  );
}
