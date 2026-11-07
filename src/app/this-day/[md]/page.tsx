import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtNumber } from '@/i18n';
import { MONTHS, allEvents, ammanToday, md, parseMd } from '@/lib/thisday';
import { Almanac } from './Almanac';
import s from './paper.module.css';

export async function generateMetadata({ params }: { params: Promise<{ md: string }> }): Promise<Metadata> {
  const p = parseMd((await params).md);
  return { title: p ? `هذا اليوم في الأردن — ${fmtNumber(p.d)} ${MONTHS[p.mo - 1]}` : 'هذا اليوم في الأردن' };
}

export default async function Day({ params }: { params: Promise<{ md: string }> }) {
  const { md: key } = await params;
  const p = parseMd(key);
  if (!p) notFound();
  const events = await allEvents();
  return (
    <main className={s.page}>
      <h1 className="sr-only">هذا اليوم في الأردن: {fmtNumber(p.d)} {MONTHS[p.mo - 1]}</h1>
      <Almanac events={events} initial={md(p.mo, p.d)} months={MONTHS} today={ammanToday()} />
      <p className={s.colophon}>{fmtNumber(events.length)} حدثاً في {fmtNumber(new Set(events.map((e) => e.date_exact.slice(5))).size)} يوماً من السنة. كل حدث مربوط بمصدره، والأحداث التي أعدّها المساعد بانتظار مراجعة الأمين.</p>
    </main>
  );
}
