import type { Metadata } from 'next';
import Link from 'next/link';
import { getDict } from '@/i18n';
import { getArchiveItem, listArchive, yearLabel, type ArchiveItem } from '@/lib/archive';
import { mediaSrc } from '@/lib/media';
import { hiresUrl } from '@/components/archive/hires';
import { CompareView, type Side } from './CompareView';
import s from './compare.module.css';

export const metadata: Metadata = { title: 'قارن مادتين', description: 'مادتان من الأرشيف جنباً إلى جنب، بتكبير متزامن.' };

const uuid = (x?: string) => (x && /^[0-9a-f-]{36}$/i.test(x) ? x : undefined);

export default async function Compare({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const t = getDict();
  const sp = await searchParams;
  const all = await listArchive({}, 100);
  const pick = (id: string | undefined, not?: string) => all.find((x) => x.id === id) ?? all.find((x) => x.id !== not);
  const a = pick(uuid(sp.a)); const b = pick(uuid(sp.b) !== a?.id ? uuid(sp.b) : undefined, a?.id);
  const [da, db] = await Promise.all([a ? getArchiveItem(a.id) : null, b ? getArchiveItem(b.id) : null]);
  const side = (it: ArchiveItem | undefined, d: typeof da): Side | null => {
    const m = it?.item_media?.[0];
    if (!it || !m?.width || !m.height) return null;
    return {
      id: it.id, title: it.title_ar, credit: `${m.credit ?? ''} · ${m.license ?? ''}`, sourceUrl: m.source_url,
      img: { src: mediaSrc(m), hires: hiresUrl(m.source_url), w: m.width, h: m.height, alt: m.alt_ar ?? it.title_ar, blur: m.blur },
      facts: [
        ['المكان', it.places?.name_ar ?? '—'],
        ['الزمن', yearLabel(it.year_start, it.year_end) ?? (it.periods?.name_ar ?? 'غير مؤرخ بعد')],
        ['العصر', it.periods?.name_ar ?? '—'],
        ['التوثيق', t.trust[it.trust]],
        ['المصادر', String(d?.sources.length ?? 0)],
      ],
    };
  };
  const options = all.map((x) => ({ id: x.id, title: x.title_ar, place: x.places?.name_ar ?? '' }));
  return (
    <main className={s.page}>
      <p className={s.crumb}><Link href="/archive">الأرشيف</Link> / قارن</p>
      <header className={s.head}>
        <h1>قارن مادتين</h1>
        <p>ضع مادتين جنباً إلى جنب، وكبّر فيهما معاً لترى التفاصيل نفسها في المكانين: حجارة البترا وحجارة جرش، أو فسيفساء مادبا وفسيفساء أم الرصاص.</p>
      </header>
      <CompareView a={side(a, da)} b={side(b, db)} options={options} />
    </main>
  );
}
