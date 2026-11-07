import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getDict, fmtNumber } from '@/i18n';
import { WindowHero } from '@/components/window/WindowHero';
import { TrustBadge } from '@/components/TrustBadge';
import { createClient } from '@/lib/supabase/server';
import archive from '../../content/archive.media.json';
import visuals from '../../content/visuals.media.json';
import s from './home.module.css';

type M = { artist: string; license: string; licenseUrl: string; page: string; width: number; height: number; blur: string };
const A = archive as unknown as Record<string, M>, V = visuals as unknown as Record<string, M>;

const halls = [
  { href: '/archive', title: 'الأرشيف', body: 'صور ووثائق من محافظات الأردن الاثنتي عشرة، لكل منها مصورها وترخيصها ومصدرها ودرجة توثيقها، وبحث عربي يتجاوز اختلاف الهمزات والتاء المربوطة.', img: '/media/archive/khazneh.jpg', m: A['khazneh'], alt: 'الخزنة في البترا', stat: 'archive' },
  { href: '/olive', title: 'زيتونة الوطن', body: 'شجرة زيتون عتيقة تنمو بذكريات الناس. لكل محافظة غصن، ولكل ذكرى ورقة تنبت بعد مراجعة الأمين.', img: '/media/archive/ajloun-forest.jpg', m: A['ajloun-forest'], alt: 'محمية غابات عجلون', stat: 'olive' },
  { href: '/write-name', title: 'اكتب اسمك بخط أجدادك', body: 'اسمك بالخط الصفوي والنبطي والمؤابي، حرفاً حرفاً، من جداول حروف موثقة، وبطاقة تحفظها.', img: '/media/visual/bg-safaitic.jpg', m: V['bg-safaitic'], alt: 'رسم صخري ونقش صفوي في متحف الأردن', stat: 'scripts' },
  { href: '/restoration', title: 'مختبر الترميم', body: 'أعد قطع فسيفساء مادبا وأم الرصاص والبترا إلى مكانها، وتعلّم خطوة خطوة كيف يعمل المرممون.', img: '/media/visual/mosaic-rasas.jpg', m: V['mosaic-rasas'], alt: 'فسيفساء أم الرصاص', stat: 'mosaics' },
  { href: '/this-day', title: 'هذا اليوم في الأردن', body: 'صفحة جريدة قديمة لأي يوم من السنة، من الأحداث الموثقة فقط، وكل حدث مربوط بمصدره.', img: '/media/archive/amman-theatre.jpg', m: A['amman-theatre'], alt: 'المدرج الروماني في عمّان', stat: 'events' },
] as const;

async function Stat({ k }: { k: (typeof halls)[number]['stat'] }) {
  const supabase = await createClient();
  const n = k === 'archive' ? (await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('is_event', false)).count
    : k === 'events' ? (await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('is_event', true)).count
    : k === 'olive' ? ((await supabase.rpc('olive_state')).data as { total: number } | null)?.total
    : k === 'mosaics' ? (await supabase.from('mosaics').select('id', { count: 'exact', head: true })).count
    : 3;
  const label = { archive: 'مادة', events: 'حدثاً موثقاً', olive: 'ورقة', mosaics: 'لوحات', scripts: 'خطوط قديمة' }[k];
  return <>{fmtNumber(n ?? 0)} {label}</>;
}

export default function Home() {
  const t = getDict();
  const h = t.home;
  const plate = A['madaba-map'];
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

        <section className={s.halls} aria-labelledby="halls-h">
          <header className={s.hallsHead}>
            <h2 id="halls-h">القاعات المفتوحة</h2>
            <p>خمس قاعات تعمل الآن بمحتوى حقيقي. القاعات الأخرى لا تظهر قبل أن تكتمل مصادرها.</p>
          </header>
          <ol className={s.hallList}>
            {halls.map((hall, i) => (
              <li key={hall.href} className={s.hall}>
                <Link href={hall.href} className={s.hallLink}>
                  <span className={s.hallImgWrap}>
                    <Image src={hall.img} alt={hall.alt} width={hall.m.width} height={hall.m.height} sizes="(max-width: 900px) 100vw, 55vw"
                      className={s.hallImg} placeholder="blur" blurDataURL={hall.m.blur} />
                  </span>
                  <span className={s.hallText}>
                    <span className={s.hallNum} aria-hidden="true">{fmtNumber(i + 1)}</span>
                    <span className={s.hallTitle}>{hall.title}</span>
                    <span className={s.hallBody}>{hall.body}</span>
                    <span className={s.hallStat}><Suspense fallback="…"><Stat k={hall.stat} /></Suspense></span>
                    <span className={s.hallGo}>ادخل القاعة <span aria-hidden="true">←</span></span>
                  </span>
                </Link>
                <p className={s.hallCredit}>الصورة: <a href={hall.m.page} target="_blank" rel="noopener noreferrer"><bdi>{hall.m.artist}</bdi></a> · <bdi>{hall.m.license}</bdi></p>
              </li>
            ))}
          </ol>
        </section>

        <figure className={s.plate}>
          <Image src="/media/archive/madaba-map.jpg" alt="خارطة مادبا في كنيسة القديس جاورجيوس" width={plate.width} height={plate.height} sizes="(max-width: 1320px) 100vw, 1320px" className={s.plateImg} placeholder="blur" blurDataURL={plate.blur} />
          <figcaption className={s.plateCap}>
            <span>خارطة مادبا، أرضية فسيفسائية في كنيسة القديس جاورجيوس البيزنطية المبكرة في مادبا.</span>
            <span>الصورة: <a href={plate.page} target="_blank" rel="noopener noreferrer"><bdi>{plate.artist}</bdi></a> · <bdi>{plate.license}</bdi></span>
          </figcaption>
        </figure>

        <section className={s.covenant} aria-labelledby="cov-h">
          <h2 id="cov-h">{h.principlesTitle}</h2>
          <ol className={s.vows}>
            {h.principles.map((p, i) => (
              <li key={p}><span className={s.vowNum} aria-hidden="true">{fmtNumber(i + 1)}</span><span>{p}</span></li>
            ))}
          </ol>
          <Link href="/olive" className="btn btn-primary">انثر ورقتك في زيتونة الوطن</Link>
        </section>

        <footer className={s.footer}>
          <p>{t.footer.note}</p>
          <p>صور المنصة من Wikimedia Commons بتراخيص مفتوحة، واسم كل مصور وترخيصه بجانب صورته.</p>
        </footer>
      </div>
    </main>
  );
}
