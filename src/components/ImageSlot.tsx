import Image from 'next/image';
import s from './ImageSlot.module.css';

type Props = {
  ratio?: string; mobileRatio?: string; label: string; description: string;
  /** عند توفر صورة مرخّصة: مسارها، ونصها البديل، ومصدرها وحقوقها */
  image?: { src: string; alt: string; credit: string; license: string };
};

/** إطار محجوز لصورة حقيقية. يبقى واضحاً أنه محجوز إلى أن تُضاف صورة مرخّصة بمصدرها. */
export function ImageSlot({ ratio = '21 / 9', mobileRatio = '4 / 3', label, description, image }: Props) {
  return (
    <figure className={s.slot} style={{ '--ratio': ratio, '--ratio-m': mobileRatio } as React.CSSProperties}>
      <div className={s.frame}>
        {image ? (
          <Image src={image.src} alt={image.alt} fill sizes="(max-width: 900px) 100vw, 1200px" className={s.img} />
        ) : (
          <div className={s.empty}>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
              <rect x="4" y="9" width="40" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 34 L19 22 L27 30 L32 25 L40 34" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="33" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p>{description}</p>
          </div>
        )}
      </div>
      <figcaption className={s.caption}>
        <span className={s.label}>{label}</span>
        {image && <span>{image.credit} · {image.license}</span>}
      </figcaption>
    </figure>
  );
}
