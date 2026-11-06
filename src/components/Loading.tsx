import s from './Loading.module.css';
export function Loading({ label = 'جارٍ التحميل' }: { label?: string }) {
  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <span className={s.bar} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
