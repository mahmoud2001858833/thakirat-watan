import { PhotoScene, PhotoCredits } from './PhotoScene';
import { ArchFrame } from './ArchFrame';
import { HeroController } from './HeroController';
import s from './hero.module.css';

/** «نافذة على الأردن»: جدار حجري بقوس، وخلفه المشهد : الخزنة في البترا. التمرير يعبر بك من القوس. */
export function WindowHero({ eyebrow, title, lede, cue }: { eyebrow: string; title: string; lede: string; cue: string }) {
  return (
    <section id="window" className={s.hero} aria-labelledby="hero-title">
      <div className={s.stage}>
        <div className={s.sceneLayer} aria-hidden="true"><PhotoScene priority /></div>
        <div className={s.wall} aria-hidden="true" />
        <div className={s.archBox} aria-hidden="true"><ArchFrame /></div>

        <div className={s.titleBlock}>
          <p className={`${s.eyebrow} settle`}>{eyebrow}</p>
          <h1 id="hero-title" className={`${s.title} settle settle-2`}>{title}</h1>
          <p className={`${s.lede} settle settle-3`}>{lede}</p>
        </div>

        <div className={s.side}>
          <HeroController targetId="window" />
          <PhotoCredits className={s.photoCredit} />
          <a className={s.cue} href="#inside">{cue}<span aria-hidden="true" className={s.cueLine} /></a>
        </div>
      </div>
    </section>
  );
}
