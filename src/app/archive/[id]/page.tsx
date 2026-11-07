import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDict } from '@/i18n';
import { getArchiveItem, listArchive, yearLabel } from '@/lib/archive';
import { mediaSrc } from '@/lib/media';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import { Credit } from '@/components/archive/Credit';
import { ArchiveWall } from '@/components/archive/ArchiveWall';
import { reportItem } from './actions';
import s from './item.module.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await getArchiveItem((await params).id);
  return d ? { title: d.item.title_ar, description: d.item.summary_ar ?? undefined } : { title: 'غير موجودة' };
}

export default async function ArchiveItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reported?: string }> }) {
  const t = getDict();
  const { id } = await params;
  const { reported } = await searchParams;
  const d = await getArchiveItem(id);
  if (!d) notFound();
  const { item, sources } = d;
  const m = item.item_media?.[0];
  const related = item.places?.key ? (await listArchive({ place: item.places.key }, 7)).filter((x) => x.id !== item.id).slice(0, 6) : [];
  return (
    <main className={s.page}>
      <p className={s.crumb}><Link href="/archive">الأرشيف</Link>{item.places && <> / <Link href={`/archive?place=${item.places.key}`}>{item.places.name_ar}</Link></>}</p>
      <article className={s.exhibit}>
        <figure className={s.figure}>
          {m && m.width && m.height && (
            <Image src={mediaSrc(m)} alt={m.alt_ar ?? item.title_ar} width={m.width} height={m.height} priority
              sizes="(max-width: 1000px) 100vw, 62vw" className={s.img} placeholder={m.blur ? 'blur' : 'empty'} blurDataURL={m.blur ?? undefined} />
          )}
          {m && <figcaption className={s.cap}><Credit m={m} /></figcaption>}
        </figure>

        <aside className={s.label} aria-label="لوحة التعريف">
          <div className={s.badges}><TrustBadge trust={item.trust} />{item.is_demo && <DemoTag />}</div>
          {item.provenance === 'assistant_research' && (
            <p className={s.note}>أعدّ المساعد هذه المادة من مصادر مفتوحة مذكورة أدناه، وهي بانتظار مراجعة الأمين.</p>
          )}
          <h1 className={s.title}>{item.title_ar}</h1>
          {item.summary_ar && <p className={s.summary}>{item.summary_ar}</p>}
          <dl className={s.dl}>
            {item.places && <><dt>المكان</dt><dd>{item.places.name_ar}</dd></>}
            {yearLabel(item.year_start, item.year_end) && <><dt>الزمن</dt><dd>{yearLabel(item.year_start, item.year_end)}{item.periods && ` · ${item.periods.name_ar}`}</dd></>}
            <dt>النوع</dt><dd>{t.kind[item.kind as keyof typeof t.kind]}</dd>
            <dt>الحقوق</dt><dd>{t.rights[item.rights as keyof typeof t.rights]}{item.rights_holder && <> — <bdi>{item.rights_holder}</bdi></>}</dd>
          </dl>
          <h2 className={s.h2}>المصادر</h2>
          <ol className={s.sources}>
            {sources.map(({ sources: src, locator }) => (
              <li key={src.id}>
                {src.url ? <a href={src.url} rel="noopener noreferrer" target="_blank"><bdi>{src.citation}</bdi></a> : <bdi>{src.citation}</bdi>}
                {locator && <span className={s.locator}> ({locator})</span>}
              </li>
            ))}
          </ol>
          <details className={s.report}>
            <summary>بلّغ عن خطأ في هذه المادة</summary>
            {reported ? <p role="status" className="notice notice-ok">وصل بلاغك إلى الأمين. شكراً لك.</p> : (
              <form action={reportItem.bind(null, item.id)}>
                <div className="field">
                  <label htmlFor="reason">نوع الملاحظة</label>
                  <select id="reason" name="reason">
                    <option value="inaccurate">معلومة غير دقيقة</option>
                    <option value="rights">حقوق الصورة أو النص</option>
                    <option value="privacy">خصوصية</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="details">التفاصيل والمصدر إن وُجد</label>
                  <textarea id="details" name="details" rows={3} maxLength={2000} />
                </div>
                <button className="btn">أرسل البلاغ</button>
              </form>
            )}
          </details>
        </aside>
      </article>

      {related.length > 0 && (
        <section className={s.related} aria-labelledby="rel-h">
          <h2 id="rel-h">من {item.places?.name_ar} أيضاً</h2>
          <ArchiveWall items={related} />
        </section>
      )}
    </main>
  );
}
