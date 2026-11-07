import Image from 'next/image';
import Link from 'next/link';
import { getDict } from '@/i18n';
import { mediaSrc } from '@/lib/media';
import { yearLabel, type ArchiveItem } from '@/lib/archive';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import s from './archive.module.css';

/** جدار المعرض: صور بأبعادها الحقيقية ولوحة تعريف صغيرة تحت كل منها، لا بطاقات */
export function ArchiveWall({ items, priority = 0 }: { items: ArchiveItem[]; priority?: number }) {
  const t = getDict();
  return (
    <ul className={s.wall}>
      {items.map((it, i) => {
        const m = it.item_media?.[0];
        return (
          <li key={it.id} className={s.piece}>
            <Link href={`/archive/${it.id}`} className={s.pieceLink}>
              {m && m.width && m.height ? (
                <Image src={mediaSrc(m)} alt={m.alt_ar ?? it.title_ar} width={m.width} height={m.height}
                  sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" className={s.img}
                  placeholder={m.blur ? 'blur' : 'empty'} blurDataURL={m.blur ?? undefined} priority={i < priority} />
              ) : null}
              <span className={s.label}>
                <span className={s.title}>{it.title_ar}</span>
                <span className={s.meta}>
                  {[it.places?.name_ar, yearLabel(it.year_start, it.year_end), t.kind[it.kind as keyof typeof t.kind]].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
            <span className={s.badges}><TrustBadge trust={it.trust} />{it.is_demo && <DemoTag />}</span>
          </li>
        );
      })}
    </ul>
  );
}
