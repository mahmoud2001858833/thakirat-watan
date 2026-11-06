import { getDict } from '@/i18n';
import s from './TrustBadge.module.css';

export type Trust = 'official_document' | 'personal_testimony' | 'circulated_account' | 'under_review';

const glyph: Record<Trust, string> = {
  official_document: '●', personal_testimony: '◐', circulated_account: '○', under_review: '◌',
};

/** شارة درجة التوثيق — شكل ونص ولون معاً، لا يُعتمد على اللون وحده */
export function TrustBadge({ trust }: { trust: Trust }) {
  const t = getDict();
  return (
    <span className={`${s.badge} ${s[trust]}`}>
      <span aria-hidden="true" className={s.glyph}>{glyph[trust]}</span>
      {t.trust[trust]}
      {trust === 'circulated_account' && <span className={s.note}> — {t.trust.circulatedNote}</span>}
    </span>
  );
}

export function DemoTag() {
  return <span className={s.demo}>{getDict().demo}</span>;
}
