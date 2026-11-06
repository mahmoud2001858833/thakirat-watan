import { ar, type Dict } from './ar';

export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

export const dir = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');

// البنية جاهزة للإنجليزية: أضف src/i18n/en.ts بنفس شكل ar وسجّله هنا.
const dictionaries: Record<Locale, Dict> = { ar, en: ar };

export function getDict(locale: Locale = defaultLocale): Dict {
  return dictionaries[locale] ?? ar;
}

const arDigits = new Intl.NumberFormat('ar-JO-u-nu-arab', { useGrouping: true });
export const fmtNumber = (n: number) => arDigits.format(n);
export const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat('ar-JO-u-nu-arab', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
