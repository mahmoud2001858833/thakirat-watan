// يجلب من Wikimedia Commons صوراً مفتوحة الترخيص مع بياناتها (المصور، الترخيص، الوصف، الرابط).
// الاستخدام: node scripts/commons.mjs "Category:Al-Khazneh" 6 > out.json
const UA = 'thakirat-watan-archive/0.1 (https://thakirat-watan.vercel.app; non-commercial cultural archive)';
const API = 'https://commons.wikimedia.org/w/api.php';
const okLicense = (l = '') => /^(cc[- ]by(-sa)?[- ]?\d|cc0|public domain|pd)/i.test(l.trim());
const strip = (h = '') => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export async function category(cat, limit = 8, minWidth = 1600) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: cat, gcmtype: 'file', gcmlimit: '60',
    prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1800', origin: '*',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {});
  return pages.map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii) return null;
    const m = ii.extmetadata ?? {};
    return {
      title: p.title, page: ii.descriptionurl, thumb: ii.thumburl, width: ii.width, height: ii.height, mime: ii.mime,
      artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), license: m.LicenseShortName?.value ?? '',
      licenseUrl: m.LicenseUrl?.value ?? '', description: strip(m.ImageDescription?.value).slice(0, 400),
      date: strip(m.DateTimeOriginal?.value).slice(0, 40),
    };
  }).filter((x) => x && /jpe?g/.test(x.mime) && x.width >= minWidth && okLicense(x.license) && x.artist).slice(0, limit);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cat, n] = process.argv.slice(2);
  console.log(JSON.stringify(await category(cat, Number(n ?? 8)), null, 1));
}

/** بحث نصي في ملفات Commons (فضاء الملفات) مع البيانات نفسها */
export async function search(q, limit = 8, minWidth = 1400) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '40',
    prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1800', origin: '*',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii) return null;
    const m = ii.extmetadata ?? {};
    return {
      title: p.title, page: ii.descriptionurl, thumb: ii.thumburl, width: ii.width, height: ii.height, mime: ii.mime,
      artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), license: m.LicenseShortName?.value ?? '',
      licenseUrl: m.LicenseUrl?.value ?? '', description: strip(m.ImageDescription?.value).slice(0, 400),
      date: strip(m.DateTimeOriginal?.value).slice(0, 40),
    };
  }).filter((x) => x && /jpe?g/.test(x.mime) && x.width >= minWidth && okLicense(x.license) && x.artist).slice(0, limit);
}
