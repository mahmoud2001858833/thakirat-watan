import { JordanScene } from './JordanScene';
import { ArchFrame } from './ArchFrame';
import s from './mini.module.css';

/** نافذة صغيرة بنفس المشهد والضوء — للصفحات الداخلية */
export function MiniWindow({ className = '' }: { className?: string }) {
  return (
    <div className={`${s.box} ${className}`} aria-hidden="true">
      <div className={s.opening}><JordanScene /></div>
      <ArchFrame />
    </div>
  );
}
