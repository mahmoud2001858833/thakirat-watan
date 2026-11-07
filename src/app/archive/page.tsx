import type { Metadata } from 'next';
import Link from 'next/link';
import { getDict, fmtNumber } from '@/i18n';
import { facets, listArchive } from '@/lib/archive';
import { ArchiveWall } from '@/components/archive/ArchiveWall';
import s from './page.module.css';

export const metadata: Metadata = { title: 'الأرشيف', description: 'صور ووثائق من الأردن، لكل منها مصدر ودرجة توثيق وحقوق استخدام.' };

type SP = { q?: string; place?: string; trust?: string; era?: string };

export default async function Archive({ searchParams }: { searchParams: Promise<SP> }) {
  const t = getDict();
  const sp = await searchParams;
  const [items, f] = await Promise.all([listArchive(sp), facets()]);
  const filtered = !!(sp.q || sp.place || sp.trust || sp.era);
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>القاعة الأولى</p>
        <h1>الأرشيف</h1>
        <p className={s.lede}>كل مادة هنا تصل ومعها مصورها وترخيصها ومصدرها. المواد التي أعدّها المساعد من مصادر مفتوحة تحمل شارة «قيد المراجعة» حتى يراجعها الأمين.</p>
      </header>

      <form className={s.search} role="search" action="/archive">
        <div className={s.qField}>
          <label htmlFor="q">ابحث في الأرشيف <span className="hint">«الأردن» و«الاردن»، و«قلعة» و«قلعه» سواء</span></label>
          <input id="q" name="q" type="search" defaultValue={sp.q ?? ''} maxLength={100} />
        </div>
        <div className={s.filters}>
          <div className="field">
            <label htmlFor="place">المحافظة</label>
            <select id="place" name="place" defaultValue={sp.place ?? ''}>
              <option value="">كل المحافظات</option>
              {f.places.map((p) => <option key={p.key} value={p.key!}>{p.name_ar}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="era">الزمن</label>
            <select id="era" name="era" defaultValue={sp.era ?? ''}>
              <option value="">كل العصور</option>
              {f.periods.map((p) => <option key={p.key} value={p.key!}>{p.name_ar}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="trust">درجة التوثيق</label>
            <select id="trust" name="trust" defaultValue={sp.trust ?? ''}>
              <option value="">كل الدرجات</option>
              {(['official_document', 'personal_testimony', 'circulated_account', 'under_review'] as const).map((k) => <option key={k} value={k}>{t.trust[k]}</option>)}
            </select>
          </div>
          <button className="btn btn-primary">اعرض</button>
        </div>
      </form>

      <p className={s.count} role="status">
        {items.length ? `${fmtNumber(items.length)} مادة` : 'لا توجد مواد تطابق البحث.'}
        {filtered && <> · <Link href="/archive">امسح البحث</Link></>}
      </p>
      <ArchiveWall items={items} priority={3} />
    </main>
  );
}
