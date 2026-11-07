export type Media = {
  storage_path: string | null; external_url: string | null; width: number | null; height: number | null;
  alt_ar: string | null; blur: string | null; credit: string | null; license: string | null;
  license_url: string | null; source_url: string | null;
};
/** المسار العام: ملفات مضمّنة في الموقع (public:) أو روابط خارجية */
export const mediaSrc = (m: Pick<Media, 'storage_path' | 'external_url'>) =>
  m.storage_path?.startsWith('public:') ? m.storage_path.slice(7) : m.external_url ?? '';
export const MEDIA_COLS = 'storage_path, external_url, width, height, alt_ar, blur, credit, license, license_url, source_url';
