import Image from 'next/image';
import archive from '../../../content/archive.media.json';
import visuals from '../../../content/visuals.media.json';
import s from './photo.module.css';

type M = { artist: string; license: string; licenseUrl: string; page: string; width: number; height: number; blur: string };
const A = archive as unknown as Record<string, M>, V = visuals as unknown as Record<string, M>;
type Slide = { src: string; alt: string; m: M; pos?: string };
const slide = (src: string, m: M, alt: string, pos?: string): Slide => ({ src, m, alt, pos });

// لكل وقت من نهار عمّان صورة أو صورتان حقيقيتان مفتوحتا الترخيص
export const PHASE_SLIDES: Record<'dawn' | 'day' | 'dusk' | 'night', Slide[]> = {
  dawn: [slide('/media/archive/rum-sunrise.jpg', A['rum-sunrise'], 'شروق الشمس فوق جبال وادي رم', '50% 60%')],
  day: [
    slide('/media/visual/hero-day.jpg', V['hero-day'], 'الخزنة في البترا', '50% 40%'),
    slide('/media/archive/ajloun-castle.jpg', A['ajloun-castle'], 'قلعة عجلون على قمة الجبل', '50% 45%'),
  ],
  dusk: [
    slide('/media/archive/rum-sunset.jpg', A['rum-sunset'], 'وادي رم عند الغروب', '40% 50%'),
    slide('/media/archive/deir.jpg', A['deir'], 'الدير في البترا', '50% 55%'),
  ],
  night: [
    slide('/media/visual/hero-night.jpg', V['hero-night'], 'وادي رم تحت درب التبانة', '50% 45%'),
    slide('/media/archive/petra-night.jpg', A['petra-night'], 'البترا ليلاً', '50% 55%'),
  ],
};

/** المشهد خلف القوس: صور حقيقية بتكبير بطيء وتلاشٍ سينمائي، تتبدل حسب ساعة عمّان (html[data-phase]).
 *  الصور غير الظاهرة لا تُحمَّل أصلاً (display:none مع التحميل الكسول) حفاظاً على الإنترنت الضعيف. */
export function PhotoScene({ sizes = '100vw' }: { sizes?: string }) {
  return (
    <div className={s.scene}>
      {Object.entries(PHASE_SLIDES).map(([phase, slides]) => (
        <div key={phase} className={s.phase} data-phase={phase} data-count={slides.length}>
          {slides.map((sl, i) => (
            <div key={sl.src} className={s.slide} data-i={i}>
              <Image src={sl.src} alt={sl.alt} fill sizes={sizes} className={s.img} style={{ objectPosition: sl.pos }}
                placeholder="blur" blurDataURL={sl.m.blur} loading="lazy" />
            </div>
          ))}
        </div>
      ))}
      <div className={s.vignette} aria-hidden="true" />
    </div>
  );
}

/** سطر الإسناد للصور الظاهرة الآن */
export function PhotoCredits({ className }: { className?: string }) {
  return (
    <p className={`${s.credits} ${className ?? ''}`}>
      {Object.entries(PHASE_SLIDES).map(([phase, slides]) => (
        <span key={phase} data-phase={phase} className={s.creditSet}>
          {slides.map((sl, i) => (
            <span key={sl.src}>{i > 0 && ' · '}الصورة: <a href={sl.m.page} target="_blank" rel="noopener noreferrer"><bdi>{sl.m.artist}</bdi></a> (<a href={sl.m.licenseUrl || sl.m.page} target="_blank" rel="license noopener noreferrer"><bdi>{sl.m.license}</bdi></a>)</span>
          ))}
        </span>
      ))}
    </p>
  );
}
