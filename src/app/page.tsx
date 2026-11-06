import Link from 'next/link';
import { getDict, fmtNumber } from '@/i18n';
import { WindowHero } from '@/components/window/WindowHero';
import { TrustBadge } from '@/components/TrustBadge';
import { ImageSlot } from '@/components/ImageSlot';
import { OliveBranch } from '@/components/OliveBranch';
import s from './home.module.css';

export default function Home() {
  const t = getDict();
  const h = t.home;
  return (
    <main>
      <WindowHero {...h.hero} />

      <div id="inside" className={s.inside}>
        <section className={s.intro} aria-labelledby="intro-k">
          <p id="intro-k" className={s.kicker}>{h.intro.kicker}</p>
          <p className={s.statement}>{h.intro.statement}</p>
          <p className={s.introBody}>{h.intro.body}</p>
        </section>

        <section className={s.legend} aria-labelledby="legend-h">
          <h2 id="legend-h" className={s.legendTitle}>{h.legendTitle}</h2>
          <dl className={s.legendList}>
            {h.legend.map((l) => (
              <div key={l.trust} className={s.legendItem}>
                <dt><TrustBadge trust={l.trust} /></dt>
                <dd>{l.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={s.plate} aria-label={h.plate.label}>
          <ImageSlot label={h.plate.label} description={h.plate.slot} />
        </section>

        <section className={s.wings} aria-labelledby="wings-h">
          <header className={s.wingsHead}>
            <h2 id="wings-h">{h.wingsTitle}</h2>
            <p>{h.wingsLede}</p>
          </header>
          <div className={s.wingGrid}>
            {h.wings.map((w, wi) => (
              <section key={w.key} className={s.wing} aria-labelledby={`wing-${w.key}`}>
                <h3 id={`wing-${w.key}`} className={s.wingTitle}>
                  <span className={s.wingNum} aria-hidden="true">{fmtNumber(wi + 1)}</span>{w.title}
                </h3>
                <ol className={s.halls}>
                  {w.halls.map((hall) => (
                    <li key={hall.title} className={s.hall}>
                      <span className={s.hallTitle}>{hall.title}</span>
                      <span className={s.hallBody}>{hall.body}</span>
                      <span className={s.soon}>{h.soon}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>

        <section className={s.olive} aria-labelledby="olive-h">
          <OliveBranch className={s.branch} />
          <div className={s.oliveText}>
            <p className={s.kicker}>{h.olive.kicker}</p>
            <h2 id="olive-h">{h.olive.title}</h2>
            <p className={s.oliveBody}>{h.olive.body}</p>
            <p className={s.oliveRule}>{h.olive.rule}</p>
            <span className={s.soon}>{h.soon}</span>
          </div>
        </section>

        <section className={s.covenant} aria-labelledby="cov-h">
          <h2 id="cov-h">{h.principlesTitle}</h2>
          <ol className={s.vows}>
            {h.principles.map((p, i) => (
              <li key={p}><span className={s.vowNum} aria-hidden="true">{fmtNumber(i + 1)}</span><span>{p}</span></li>
            ))}
          </ol>
          <Link href="/signin" className="btn btn-primary">{h.join}</Link>
        </section>

        <footer className={s.footer}>
          <p>{t.footer.note}</p>
          <p>{t.footer.art}</p>
        </footer>
      </div>
    </main>
  );
}
