import { JordanScene } from './JordanScene';
import { ArchFrame } from './ArchFrame';
import { HeroController } from './HeroController';
import s from './hero.module.css';
import sc from './scene.module.css';

/** «نافذة على الأردن»: جدار حجري بقوس، وخلفه المشهد بضوء ساعة عمّان. التمرير يعبر بك من القوس. */
export function WindowHero({ eyebrow, title, lede, cue }: { eyebrow: string; title: string; lede: string; cue: string }) {
  return (
    <section id="window" className={s.hero} aria-labelledby="hero-title">
      <div className={`${s.stage} ${sc.vars}`}>
        <div className={s.sceneLayer} aria-hidden="true"><JordanScene /></div>
        <div className={s.wall} aria-hidden="true" />
        <div className={s.archBox} aria-hidden="true"><ArchFrame /></div>

        <div className={s.titleBlock}>
          <p className={`${s.eyebrow} settle`}>{eyebrow}</p>
          <h1 id="hero-title" className={`${s.title} settle settle-2`}>{title}</h1>
          <p className={`${s.lede} settle settle-3`}>{lede}</p>
        </div>

        <div className={s.side}>
          <HeroController targetId="window" />
          <a className={s.cue} href="#inside">{cue}<span aria-hidden="true" className={s.cueLine} /></a>
        </div>
      </div>
    </section>
  );
}
