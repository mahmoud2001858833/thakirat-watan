import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { fmtNumber } from '@/i18n';
import { dims, listMosaics } from '@/lib/mosaics';
import s from './lab.module.css';

export const metadata: Metadata = { title: 'مختبر الترميم', description: 'أعد قطع فسيفساء أردنية إلى مكانها، وتعلّم كيف يعمل المرممون.' };

export default async function Lab() {
  const list = await listMosaics();
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>العب وتعلّم</p>
        <h1>مختبر الترميم</h1>
        <p className={s.lede}>ثلاث لوحات فسيفساء من أرض الأردن تفككت قطعها. أعدها إلى مكانها، وكلما استقامت قطع أكثر انفتحت أمامك خطوة من عمل المرممين.</p>
      </header>
      <ol className={s.list}>
        {list.map((m, i) => {
          const d = dims(m.image_path);
          return (
            <li key={m.slug} className={s.entry}>
              <Link href={`/restoration/${m.slug}`} className={s.entryLink}>
                <Image src={m.image_path} alt="" width={d.width} height={d.height} sizes="(max-width: 900px) 100vw, 40vw" className={s.thumb} placeholder="blur" blurDataURL={d.blur} />
                <span className={s.entryText}>
                  <span className={s.num} aria-hidden="true">{fmtNumber(i + 1)}</span>
                  <span className={s.entryTitle}>{m.title_ar}</span>
                  <span className={s.entrySum}>{m.summary_ar}</span>
                  <span className={s.level}>{fmtNumber(m.grid * m.grid)} قطعة</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
