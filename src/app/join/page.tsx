import type { Metadata } from 'next';
import { JoinForm } from './JoinForm';
import s from '@/components/classroom/ui.module.css';

export const metadata: Metadata = { title: 'ادخل الجلسة' };

export default function Join() {
  return (
    <main className={s.page} style={{ maxWidth: '34rem' }}>
      <header className={s.head}>
        <p className={s.kicker}>الجلسة المباشرة</p>
        <h1>ادخل الجلسة</h1>
        <p className={s.lede}>اكتب الرمز الظاهر على شاشة الصف، من ستة أرقام.</p>
      </header>
      <JoinForm />
    </main>
  );
}
