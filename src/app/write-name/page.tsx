import type { Metadata } from 'next';
import { Noto_Sans_Nabataean, Noto_Sans_Old_North_Arabian, Noto_Sans_Phoenician } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import visuals from '../../../content/visuals.media.json';
import { NameStudio, type ScriptInfo } from './NameStudio';
import s from './name.module.css';

const ona = Noto_Sans_Old_North_Arabian({ weight: '400', subsets: ['old-north-arabian'], display: 'swap' });
const nab = Noto_Sans_Nabataean({ weight: '400', subsets: ['nabataean'], display: 'swap' });
const phn = Noto_Sans_Phoenician({ weight: '400', subsets: ['phoenician'], display: 'swap' });

export const metadata: Metadata = { title: 'اكتب اسمك بخط أجدادك', description: 'اسمك بالخط الصفوي والنبطي والمؤابي، حرفاً حرفاً، من جداول موثقة.' };

type V = { artist: string; license: string; licenseUrl: string; page: string };
const v = visuals as unknown as Record<string, V>;
const credit = (k: string) => ({ credit: v[k].artist, license: v[k].license, license_url: v[k].licenseUrl || null, source_url: v[k].page });

export default async function WriteName() {
  const supabase = await createClient();
  const { data: letters } = await supabase.from('script_letters')
    .select('script, codepoint, arabic, translit, name, note_ar, sources(citation, url)').order('position');
  const src = (script: string) => {
    const l = (letters ?? []).find((x) => x.script === script) as unknown as { sources: { citation: string; url: string } | null } | undefined;
    return l?.sources ?? null;
  };
  const scripts: ScriptInfo[] = [
    { key: 'safaitic', name: 'الصفوي', font: ona.style.fontFamily, bg: '/media/visual/bg-safaitic.jpg', bgCredit: credit('bg-safaitic'), source: src('safaitic'),
      about: 'خط عربي قديم نقشه سكان البادية في الحرّة، شمال الأردن وجنوب سوريا، على الصخور. حروفه 28 تقابل أصوات العربية تقريباً واحداً بواحد.',
      extra: { citation: 'ويكيبيديا: Safaitic — جدول الحروف ومقابلاتها العربية', url: 'https://en.wikipedia.org/wiki/Safaitic' }, unicode: 'https://www.unicode.org/charts/PDF/U10A80.pdf' },
    { key: 'nabataean', name: 'النبطي', font: nab.style.fontFamily, bg: '/media/visual/bg-nabataean.jpg', bgCredit: credit('bg-nabataean'), source: src('nabataean'),
      about: 'خط الأنباط، أهل البترا. له 22 حرفاً، فتشترك فيه أصوات عربية في حرف واحد: الثاء مع التاء، والذال مع الدال، والخاء مع الحاء، والظاء مع الطاء، والضاد مع الصاد، والغين مع العين.',
      extra: null, unicode: 'https://www.unicode.org/charts/PDF/U10880.pdf' },
    { key: 'moabite', name: 'المؤابي', font: phn.style.fontFamily, bg: '/media/visual/bg-moabite.jpg', bgCredit: credit('bg-moabite'), source: src('moabite'),
      about: 'الخط الذي نُقشت به مسلة ميشع ملك مؤاب نحو 840 ق.م، وهو فرع من الأبجدية الفينيقية. نعرضه بحروف الكتلة الفينيقية في Unicode، وله 22 حرفاً.',
      extra: null, unicode: 'https://www.unicode.org/charts/PDF/U10900.pdf' },
  ];
  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.kicker}>العب وتعلّم</p>
        <h1>اكتب اسمك بخط أجدادك</h1>
        <p className={s.lede}>اكتب اسمك بالعربية، فنكتبه لك بثلاثة خطوط عرفتها هذه الأرض قبل الخط العربي، حرفاً حرفاً، مع شرح كل حرف ومصدره.</p>
      </header>
      <NameStudio scripts={scripts} letters={(letters ?? []) as never} />
    </main>
  );
}
