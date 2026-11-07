import 'server-only';
import { createClient } from './supabase/server';

export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseMd(md: string) {
  const m = /^(\d{2})-(\d{2})$/.exec(md); if (!m) return null;
  const mo = +m[1], d = +m[2];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= DAYS_IN[mo - 1] ? { mo, d } : null;
}
export const md = (mo: number, d: number) => `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function ammanToday() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return md(+p.find((x) => x.type === 'month')!.value, +p.find((x) => x.type === 'day')!.value);
}
export const shift = (mo: number, d: number, by: number) => {
  const date = new Date(Date.UTC(2024, mo - 1, d + by)); // سنة كبيسة حتى يوجد 29 شباط
  return md(date.getUTCMonth() + 1, date.getUTCDate());
};

export type DayEvent = { id: string; title_ar: string; summary_ar: string | null; date_exact: string; trust: 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review'; is_demo: boolean;
  item_sources: { locator: string | null; sources: { citation: string; url: string | null } }[] };

export async function eventsOn(mo: number, d: number) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc('this_day', { p_month: mo, p_day: d });
  const ids = (rows ?? []).map((r: { id: string }) => r.id);
  if (!ids.length) return [];
  const { data } = await supabase.from('items').select('id, title_ar, summary_ar, date_exact, trust, is_demo, item_sources(locator, sources(citation, url))').in('id', ids).order('date_exact');
  return (data ?? []) as unknown as DayEvent[];
}

export async function eventDays() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('event_days');
  return ((data ?? []) as { m: number; d: number; n: number }[]).map((x) => ({ key: md(x.m, x.d), n: x.n }));
}

/** كل الأحداث المنشورة مرتبة باليوم من السنة (لتقليب صفحات الجريدة في المتصفح) */
export async function allEvents() {
  const supabase = await createClient();
  const { data } = await supabase.from('items').select('id, title_ar, summary_ar, date_exact, trust, is_demo, item_sources(locator, sources(citation, url))')
    .eq('is_event', true).eq('status', 'published').not('date_exact', 'is', null).limit(2000);
  return ((data ?? []) as unknown as DayEvent[]).sort((a, b) => a.date_exact.slice(5).localeCompare(b.date_exact.slice(5)) || a.date_exact.localeCompare(b.date_exact));
}
