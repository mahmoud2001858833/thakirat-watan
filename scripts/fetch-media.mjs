// ينزّل صور Commons المختارة ويضغطها في public/media، ويحفظ بيانات الإسناد كاملة.
// الاستخدام: node scripts/fetch-media.mjs content/archive.json public/media/archive content/archive.media.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import sharp from 'sharp';
const UA = 'thakirat-watan-archive/0.1 (https://thakirat-watan.vercel.app; non-commercial cultural archive)';
const [manifest, outDir, metaOut, maxW = '1600'] = process.argv.slice(2);
const list = JSON.parse(readFileSync(manifest, 'utf8'));
const strip = (h = '') => { const t = h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); const n = t.length / 2; return t.length % 2 === 0 && t.slice(0, n) === t.slice(n) ? t.slice(0, n) : t; };
mkdirSync(outDir, { recursive: true });
const meta = existsSync(metaOut) ? JSON.parse(readFileSync(metaOut, 'utf8')) : {};
for (const it of list) {
  if (meta[it.key]?.ok && existsSync(`${outDir}/${it.key}.jpg`)) continue;
  const params = new URLSearchParams({ action: 'query', format: 'json', titles: it.file, prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1800', redirects: '1' });
  const j = await (await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } })).json();
  const p = Object.values(j.query?.pages ?? {})[0];
  const ii = p?.imageinfo?.[0];
  if (!ii) { console.log('MISSING', it.key, it.file); meta[it.key] = { ok: false }; continue; }
  const m = ii.extmetadata ?? {};
  const buf = Buffer.from(await (await fetch(ii.thumburl, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const img = sharp(buf).rotate().resize({ width: +maxW, height: +maxW, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true });
  const info = await img.toFile(`${outDir}/${it.key}.jpg`);
  const tiny = await sharp(buf).resize(16).blur().jpeg({ quality: 40 }).toBuffer();
  meta[it.key] = {
    ok: true, title: p.title, page: ii.descriptionurl, artist: strip(m.Artist?.value), credit: strip(m.Credit?.value),
    license: m.LicenseShortName?.value ?? '', licenseUrl: m.LicenseUrl?.value ?? '', description: strip(m.ImageDescription?.value).slice(0, 500),
    date: strip(m.DateTimeOriginal?.value).slice(0, 40), width: info.width, height: info.height, bytes: info.size,
    blur: `data:image/jpeg;base64,${tiny.toString('base64')}`,
  };
  console.log('ok', it.key, info.width + 'x' + info.height, Math.round(info.size / 1024) + 'KB', meta[it.key].license, '|', meta[it.key].artist.slice(0, 30));
  writeFileSync(metaOut, JSON.stringify(meta, null, 1));
  await new Promise((r) => setTimeout(r, 400));
}
writeFileSync(metaOut, JSON.stringify(meta, null, 1));
