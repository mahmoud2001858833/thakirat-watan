import type { Metadata } from 'next';
import { MiniWindow } from '@/components/window/MiniWindow';
import { confirmLink } from './actions';
import s from '../../signin/signin.module.css';

export const metadata: Metadata = { title: 'إكمال الدخول' };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash = '', type = 'email', next = '/studio' } = await searchParams;
  return (
    <main className={s.wrap}>
      <div className={s.art}><MiniWindow className={s.window} /></div>
      <div className={`${s.panel} settle`}>
        <p className={s.kicker}>باب المعرض</p>
        <h1 className={s.title}>أهلاً بعودتك</h1>
        <p className={s.lede}>اضغط الزر لإكمال الدخول. الرابط يعمل مرة واحدة ومن أي جهاز.</p>
        <form action={confirmLink}>
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button className="btn btn-primary">أكمل الدخول</button>
        </form>
      </div>
    </main>
  );
}
