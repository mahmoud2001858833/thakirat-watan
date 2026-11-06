import s from './TimeRuler.module.css';

// مسطرة زمنية لوغاريتمية: من 2.5 مليون سنة مضت حتى اليوم
const ticks = [
  { ago: 2_500_000, label: '٢٫٥ مليون سنة' },
  { ago: 250_000, label: '٢٥٠ ألف' },
  { ago: 25_000, label: '٢٥ ألف' },
  { ago: 2_500, label: '٢٥٠٠ سنة' },
  { ago: 250, label: '٢٥٠ سنة' },
  { ago: 25, label: '٢٥ سنة' },
  { ago: 1, label: 'اليوم' },
];
const max = Math.log10(2_500_000);
const pos = (ago: number) => (1 - Math.log10(ago) / max) * 100;

export function TimeRuler({ label }: { label: string }) {
  return (
    <figure className={s.ruler} aria-label={label}>
      <div className={s.line} aria-hidden="true">
        {/* علامات صغرى لكل ربع رتبة عشرية، وكبرى عند كل تسمية */}
        {Array.from({ length: Math.ceil(max * 4) + 1 }, (_, i) => (
          <span key={`m${i}`} className={s.minor} style={{ insetInlineStart: `${Math.min((i / 4 / max) * 100, 100)}%` }} />
        ))}
        {ticks.map((t) => <span key={t.ago} className={s.major} style={{ insetInlineStart: `${pos(t.ago)}%` }} />)}
      </div>
      <ol className={s.labels}>
        {ticks.map((t) => (
          <li key={t.ago} style={{ insetInlineStart: `${pos(t.ago)}%` }}>{t.label}</li>
        ))}
      </ol>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
