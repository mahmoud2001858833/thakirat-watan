import type { Media } from '@/lib/media';

/** سطر الإسناد: المصور والترخيص ورابط المصدر — إلزامي مع كل صورة */
export function Credit({ m, className }: { m: Pick<Media, 'credit' | 'license' | 'license_url' | 'source_url'>; className?: string }) {
  if (!m.credit && !m.license) return null;
  return (
    <span className={className}>
      الصورة: <bdi>{m.credit}</bdi>
      {m.license && <> · {m.license_url ? <a href={m.license_url} rel="license noopener noreferrer" target="_blank"><bdi>{m.license}</bdi></a> : <bdi>{m.license}</bdi>}</>}
      {m.source_url && <> · <a href={m.source_url} rel="noopener noreferrer" target="_blank">المصدر</a></>}
    </span>
  );
}
