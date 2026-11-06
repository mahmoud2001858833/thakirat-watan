import type { Metadata, Viewport } from 'next';
import { Amiri, IBM_Plex_Sans_Arabic, Reem_Kufi } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { getDict, dir, defaultLocale } from '@/i18n';
import './globals.css';

const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap' });
const reem = Reem_Kufi({ subsets: ['arabic', 'latin'], weight: 'variable', variable: '--font-reem', display: 'swap' });
const amiri = Amiri({ subsets: ['arabic', 'latin'], weight: ['400'], variable: '--font-amiri', display: 'swap' });

const t = getDict();

export const metadata: Metadata = {
  title: { default: t.site.name, template: `%s — ${t.site.name}` },
  description: t.site.tagline,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thakirat-watan.vercel.app'),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f2e8' };

// قبل الرسم: الوضع الداكن فقط إن اختاره المستخدم صراحة، ووقت النهار حسب ساعة عمّان
const bootScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}
try{var h=+new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Asia/Amman'}).format(new Date());
document.documentElement.dataset.phase=h>=5&&h<7?'dawn':h>=7&&h<16?'day':h>=16&&h<19?'dusk':'night'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} dir={dir(defaultLocale)} className={`${plex.variable} ${reem.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">{t.site.skip}</a>
        <SiteHeader />
        <div id="main" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
