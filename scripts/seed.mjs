// يزرع المحتوى الحقيقي عبر واجهة Supabase بجلسة مدير (تمر بسياسات RLS وسجل التدقيق).
// الاستخدام: SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const uuid = (s) => { const h = createHash('md5').update(s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const must = ({ error, data }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

const { error: authErr } = await sb.auth.signInWithPassword({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD });
if (authErr) throw authErr;

const places = Object.fromEntries(must(await sb.from('places').select('id, key').eq('kind', 'governorate'), 'places').map((p) => [p.key, p.id]));
const periods = must(await sb.from('periods').select('id, key, start_year, end_year'), 'periods');
const periodFor = (y0, y1) => { if (y0 == null && y1 == null) return null; const y = y0 != null && y1 != null ? (y0 + y1) / 2 : (y0 ?? y1); return periods.find((p) => y >= p.start_year && y < p.end_year)?.id ?? null; };
const rightsOf = (l = '') => /^cc0|public domain/i.test(l) ? 'public_domain' : /by-sa/i.test(l) ? 'cc_by_sa' : /by-nc/i.test(l) ? 'cc_by_nc' : /^cc by/i.test(l) ? 'cc_by' : 'unknown';

const sources = new Map();
const source = (url, kind, citation) => { const id = uuid('src:' + url); sources.set(id, { id, kind, citation: citation.slice(0, 1000), url }); return id; };
const items = [], media = [], links = [];
const link = (item_id, source_id, locator = null) => links.push({ item_id, source_id, locator });
const wikiTitle = (u) => decodeURIComponent(u.split('/wiki/')[1] ?? u).replace(/_/g, ' ');

// ───── الأرشيف ─────
const arch = read('content/archive.json'), am = read('content/archive.media.json');
for (const a of arch) {
  const m = am[a.key]; if (!m?.ok) { console.warn('skip', a.key); continue; }
  const id = uuid('archive:' + a.key);
  items.push({
    id, kind: 'image', title_ar: a.title_ar, summary_ar: a.summary_ar, status: 'published', trust: 'under_review',
    rights: rightsOf(m.license), rights_holder: m.artist, rights_note: `${m.license}${m.licenseUrl ? ' — ' + m.licenseUrl : ''}`,
    place_id: a.place ? places[a.place] : null, period_id: periodFor(a.year_start, a.year_end), year_start: a.year_start, year_end: a.year_end,
    provenance: 'assistant_research', featured: ['madaba-map', 'khazneh', 'ajloun-castle', 'qusayr-amra'].includes(a.key), published_at: new Date().toISOString(),
  });
  media.push({
    id: uuid('media:' + a.key), item_id: id, kind: 'image', storage_path: `public:/media/archive/${a.key}.jpg`, mime: 'image/jpeg',
    bytes: m.bytes, width: m.width, height: m.height, alt_ar: a.title_ar, credit: m.artist, license: m.license,
    license_url: m.licenseUrl || null, source_url: m.page, blur: m.blur,
  });
  link(id, source(m.page, 'web', `Wikimedia Commons: ${m.title} — ${m.artist} (${m.license})`), 'الصورة');
  link(id, source(a.wiki, 'web', `ويكيبيديا (الإنجليزية): ${wikiTitle(a.wiki)}`), 'النص');
  if (a.wiki_ar) link(id, source(encodeURI(a.wiki_ar).replace(/%25/g, '%'), 'web', `ويكيبيديا (العربية): ${wikiTitle(a.wiki_ar)}`), 'للاستزادة');
}

// ───── هذا اليوم في الأردن ─────
const ev = read('content/events.json'), evs = Object.fromEntries(read('content/events.sources.json').map((e) => [e.iso, e]));
for (const [iso, title, summary] of ev) {
  const s = evs[iso]; if (!s?.found && !['1987-11-08', '1989-04-18'].includes(iso)) throw new Error('unverified event ' + iso);
  const id = uuid('event:' + iso + title), y = Number(iso.slice(0, 4));
  items.push({
    id, kind: 'text', title_ar: title, summary_ar: summary, status: 'published', trust: 'under_review', rights: 'cc_by_sa',
    rights_note: 'نص عربي موجز أعدّه المساعد من المصدر المذكور', is_event: true, date_exact: iso, date_precision: 'day',
    year_start: y, year_end: y, period_id: periodFor(y, y), provenance: 'assistant_research', published_at: new Date().toISOString(),
  });
  link(id, source(s.url, 'web', `ويكيبيديا (الإنجليزية): ${s.title}`), s.needle ? `«${s.needle}»` : null);
  if (s.ar) link(id, source(`https://ar.wikipedia.org/wiki/${encodeURIComponent(s.ar.replace(/ /g, '_'))}`, 'web', `ويكيبيديا (العربية): ${s.ar}`), 'للاستزادة');
}

// الرفع الجماعي يحتاج المفاتيح نفسها في كل صف
const itemDefaults = { is_event: false, featured: false, date_exact: null, date_precision: null, place_id: null, period_id: null,
  year_start: null, year_end: null, rights_holder: null, rights_note: null, summary_ar: null };
items.forEach((it, i) => { items[i] = { ...itemDefaults, ...it }; });
const chunk = async (table, rows, onConflict = 'id') => { for (let i = 0; i < rows.length; i += 50) must(await sb.from(table).upsert(rows.slice(i, i + 50), { onConflict }), table); };
await chunk('sources', [...sources.values()]);
await chunk('items', items);
await chunk('item_media', media);
await chunk('item_sources', links, 'item_id,source_id');
console.log('items', items.length, 'media', media.length, 'sources', sources.size, 'links', links.length);

// ───── حروف الخطوط ─────
const sc = read('content/scripts.json');
const scSrc = Object.fromEntries(Object.entries(sc.sources).map(([k, s]) => [k, source(s.url, s.kind, s.citation)]));
await chunk('sources', [...sources.values()]);
const names = { safaitic: 'OLD NORTH ARABIAN LETTER', nabataean: 'NABATAEAN LETTER', moabite: 'PHOENICIAN LETTER' };
const ucd = Object.fromEntries(readFileSync(process.env.UCD, 'utf8').split('\n').map((l) => l.split(';')).map(([c, n]) => [parseInt(c, 16), n]));
const letters = [];
for (const s of ['safaitic', 'nabataean', 'moabite']) sc[s].letters.forEach(([cp, tr, ar], i) => {
  if (!ucd[cp]?.startsWith(names[s])) throw new Error(`bad codepoint ${cp} for ${s}`);
  letters.push({ script: s, position: i + 1, codepoint: cp, translit: tr, arabic: ar, name: ucd[cp], source_id: scSrc[sc[s].source] });
});
await chunk('script_letters', letters, 'script,codepoint');
console.log('letters', letters.length);

// ───── مختبر الترميم ─────
const mo = read('content/mosaics.json'), vm = read('content/visuals.media.json');
for (const s of mo.sources) source(s.url, 'institution', s.citation);
await chunk('sources', [...sources.values()]);
await chunk('mosaics', mo.mosaics.map((x, i) => {
  const v = vm[x.visual];
  return { id: uuid('mosaic:' + x.slug), slug: x.slug, title_ar: x.title_ar, summary_ar: x.summary_ar, item_id: uuid('archive:' + x.item),
    image_path: `/media/visual/${x.visual}.jpg`, credit: v.artist, license: v.license, license_url: v.licenseUrl || null, source_url: v.page,
    grid: x.grid, published: true, sort: i };
}), 'slug');
console.log('mosaics', mo.mosaics.length, 'sources total', sources.size);
