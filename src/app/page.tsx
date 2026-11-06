import Link from 'next/link';
import { getDict, fmtNumber } from '@/i18n';
import { TimeRuler } from '@/components/TimeRuler';
import s from './home.module.css';

export default function Home() {
  const t = getDict();
  const h = t.home;
  return (
    <main className={s.hall}>
      <section className={s.entrance} aria-labelledby="hall-title">
        <p className={`${s.eyebrow} settle`}>{h.eyebrow}</p>
        <h1 id="hall-title" className={`${s.title} settle settle-2`}>{h.title}</h1>
        <p className={`${s.lede} settle settle-3`}>{h.lede}</p>
      </section>

      <div className={`${s.rulerWrap} settle settle-4`}>
        <TimeRuler label="المسطرة الزمنية: من مليونين ونصف مليون سنة حتى اليوم" />
      </div>

      <section aria-labelledby="halls-title" className={s.strata}>
        <h2 id="halls-title" className={s.sectionTitle}>{h.halls}</h2>
        <ol className={s.list}>
          {h.hallsList.map((hall, i) => (
            <li key={hall.key} className={s.stratum}>
              <span className={s.index} aria-hidden="true">{fmtNumber(i + 1)}</span>
              <div>
                <h3 className={s.hallTitle}>{hall.title}</h3>
                <p className={s.hallBody}>{hall.body}</p>
              </div>
              <span className={s.state}>{h.soon}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className={s.label} aria-labelledby="covenant">
        <h2 id="covenant" className={s.labelTitle}>{h.principlesTitle}</h2>
        <ul>
          {h.principles.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <Link href="/signin" className="btn">{t.nav.contribute}</Link>
      </aside>

      <footer className={s.footer}><p>{t.footer.note}</p></footer>
    </main>
  );
}
