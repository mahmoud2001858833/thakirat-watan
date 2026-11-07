/** رابط دقة عالية من Wikimedia Commons لصفحة الملف (يُحمَّل عند الطلب فقط) */
export function hiresUrl(sourceUrl: string | null | undefined, width = 3840) {
  const m = sourceUrl?.match(/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/);
  return m ? `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1].slice(5)}?width=${width}` : null;
}
