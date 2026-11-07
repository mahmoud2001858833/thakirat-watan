import Image from 'next/image';
import visuals from '../../../content/visuals.media.json';
import s from './photo.module.css';

type M = { artist: string; license: string; licenseUrl: string; page: string; width: number; height: number; blur: string };
const HERO = (visuals as unknown as Record<string, M>)['hero-khazneh'];
export const HERO_ALT = 'الخزنة في البترا منحوتة في الصخر الوردي، في ضوء الصباح الباكر';

/** المشهد خلف القوس: صورة واحدة ثابتة للخزنة في البترا (Wikimedia Commons، ترخيص مفتوح). */
export function PhotoScene({ sizes = '100vw', priority = false }: { sizes?: string; priority?: boolean }) {
  return (
    <div className={s.scene}>
      <Image src="/media/visual/hero-khazneh.jpg" alt={HERO_ALT} fill sizes={sizes} className={s.img}
        placeholder="blur" blurDataURL={HERO.blur} priority={priority} quality={82} />
      <div className={s.vignette} aria-hidden="true" />
    </div>
  );
}

/** سطر الإسناد للصورة */
export function PhotoCredits({ className }: { className?: string }) {
  return (
    <p className={`${s.credits} ${className ?? ''}`}>
      الخزنة، البترا. الصورة: <a href={HERO.page} target="_blank" rel="noopener noreferrer"><bdi>{HERO.artist}</bdi></a>،{' '}
      ويكيميديا كومنز (<a href={HERO.licenseUrl || HERO.page} target="_blank" rel="license noopener noreferrer"><bdi>{HERO.license}</bdi></a>)
    </p>
  );
}
