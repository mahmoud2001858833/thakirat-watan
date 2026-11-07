import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtNumber } from '@/i18n';
import { MONTHS, eventDays, eventsOn, md, parseMd, shift } from '@/lib/thisday';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import { DayPicker } from './DayPicker';
import s from './paper.module.css';

const yearAr = (iso: string) => new Intl.NumberFormat('ar-JO-u-nu-arab', { useGrouping: false }).format(+iso.slice(0, 4));

export async function generateMetadata({ params }: { params: Promise<{ md: string }> }): Promise<Metadata> {
  const p = parseMd((await params).md);
  return { title: p ? `هذا اليوم في الأردن — ${fmtNumber(p.d)} ${MONTHS[p.mo - 1]}` : 'هذا اليوم في الأردن' };
}

export default async function Day({ params }: { params: Promise<{ md: string }> }) {
  const { md: key } = await params;
  const p = parseMd(key);
  if (!p) notFound();
  const [events, days] = await Promise.all([eventsOn(p.mo, p.d), eventDays()]);
  const keys = days.map((x) => x.key);
  const nextWith = keys.find((k) => k > key) ?? keys[0];
  const prevWith = [...keys].reverse().find((k) => k < key) ?? keys.at(-1);
  // العنوان الرئيس للصفحة: الحدث الأحدث، ثم البقية بترتيب الزمن
  const lead = events.at(-1), rest = events.slice(0, -1);
  return (
    <main className={s.page}>
      <div className={s.paper}>
        <header className={s.masthead}>
          <p className={s.edition}>ذاكرة وطن · صفحة من الأرشيف</p>
          <h1 className={s.name}>هذا اليوم في الأردن</h1>
          <div className={s.dateline}>
            <Link href={`/this-day/${shift(p.mo, p.d, -1)}`} className={s.navBtn} aria-label="اليوم السابق">‹ السابق</Link>
            <p className={s.date}><span>{fmtNumber(p.d)}</span> {MONTHS[p.mo - 1]}</p>
            <Link href={`/this-day/${shift(p.mo, p.d, 1)}`} className={s.navBtn} aria-label="اليوم التالي">التالي ›</Link>
          </div>
          <DayPicker mo={p.mo} d={p.d} months={MONTHS} />
        </header>

        {!lead ? (
          <section className={s.empty}>
            <p className={s.emptyTitle}>لا توجد أحداث موثقة لهذا اليوم بعد.</p>
            <p>ننشر هنا الأحداث ذات المصادر فقط. أقرب الأيام التي فيها أحداث:</p>
            <p className={s.near}>
              {prevWith && <Link href={`/this-day/${prevWith}`}>{fmtNumber(parseMd(prevWith)!.d)} {MONTHS[parseMd(prevWith)!.mo - 1]}</Link>}
              {nextWith && nextWith !== prevWith && <Link href={`/this-day/${nextWith}`}>{fmtNumber(parseMd(nextWith)!.d)} {MONTHS[parseMd(nextWith)!.mo - 1]}</Link>}
            </p>
          </section>
        ) : (
          <>
            <article className={s.lead}>
              <p className={s.year}>{yearAr(lead.date_exact)}</p>
              <h2 className={s.headline}>{lead.title_ar}</h2>
              <p className={s.body}>{lead.summary_ar}</p>
              <Footnote e={lead} />
            </article>
            {rest.length > 0 && (
              <div className={s.columns}>
                {rest.map((e) => (
                  <article key={e.id} className={s.story}>
                    <p className={s.year}>{yearAr(e.date_exact)}</p>
                    <h3 className={s.subhead}>{e.title_ar}</h3>
                    <p className={s.body}>{e.summary_ar}</p>
                    <Footnote e={e} />
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <footer className={s.colophon}>
          <p>{fmtNumber(days.reduce((a, x) => a + x.n, 0))} حدثاً في {fmtNumber(days.length)} يوماً من السنة. كل حدث مربوط بمصدره، والأحداث التي أعدّها المساعد بانتظار مراجعة الأمين.</p>
          <Link href={`/this-day/${md(p.mo, p.d) === nextWith ? keys[0] : nextWith}`}>اليوم التالي الذي فيه أحداث ‹</Link>
        </footer>
      </div>
    </main>
  );
}

function Footnote({ e }: { e: Awaited<ReturnType<typeof eventsOn>>[number] }) {
  return (
    <div className={s.foot}>
      <span className={s.badges}><TrustBadge trust={e.trust} />{e.is_demo && <DemoTag />}</span>
      <span className={s.src}>
        المصدر: {e.item_sources.map(({ sources: src }, i) => (
          <span key={i}>{i > 0 && '، '}{src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer"><bdi>{src.citation}</bdi></a> : <bdi>{src.citation}</bdi>}</span>
        ))}
      </span>
    </div>
  );
}
