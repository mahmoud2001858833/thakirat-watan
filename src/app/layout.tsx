import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Markazi_Text } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { getDict, dir, defaultLocale } from '@/i18n';
import './globals.css';

const plex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap',
});
const markazi = Markazi_Text({
  subsets: ['arabic', 'latin'], weight: ['500', '600', '700'], variable: '--font-markazi', display: 'swap',
});

const t = getDict();

export const metadata: Metadata = {
  title: { default: t.site.name, template: `%s — ${t.site.name}` },
  description: t.site.tagline,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3ede2' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
};

// يطبّق الوضع المحفوظ قبل الرسم لتفادي الوميض
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} dir={dir(defaultLocale)} className={`${plex.variable} ${markazi.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">{t.site.skip}</a>
        <SiteHeader />
        <div id="main" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
