import { getDict, fmtDate } from '@/i18n';
import { CONSENT_TEXT } from '@/lib/consent';
import { addConsent, addSource, removeSource, transition, updateItem, withdrawConsent } from '@/lib/actions/items';
import { TrustBadge, DemoTag } from '@/components/TrustBadge';
import { ItemFields } from './ItemFields';
import type { ConsentRow, EventRow, ItemRow, SourceLink } from './types';
import s from './workbench.module.css';

type Props = {
  item: ItemRow; sources: SourceLink[]; consents: ConsentRow[]; events: EventRow[];
  mode: 'studio' | 'admin'; staff: boolean; isAdmin: boolean; isOwner: boolean;
  children?: React.ReactNode;
};

type Move = { to: string; label: string; danger?: boolean; reason?: boolean };
const ownerMoves: Record<string, Move[]> = {
  draft: [{ to: 'in_review', label: 'أرسل للمراجعة' }],
  in_review: [{ to: 'draft', label: 'استرجع إلى المسودة' }],
  rejected: [{ to: 'draft', label: 'أعد إلى المسودة للتعديل' }],
};
const staffMoves: Record<string, Move[]> = {
  draft: [{ to: 'in_review', label: 'انقل إلى المراجعة' }],
  in_review: [{ to: 'verified', label: 'وثّق' }, { to: 'rejected', label: 'ارفض', danger: true, reason: true }],
  verified: [{ to: 'published', label: 'انشر' }, { to: 'in_review', label: 'أعد للمراجعة' }, { to: 'rejected', label: 'ارفض', danger: true, reason: true }],
  published: [{ to: 'archived', label: 'اسحب من العرض', danger: true, reason: true }, { to: 'in_review', label: 'أعد للمراجعة', reason: true }],
  archived: [{ to: 'published', label: 'أعد النشر' }],
  rejected: [],
};

export function ItemWorkbench({ item, sources, consents, events, mode, staff, isAdmin, isOwner, children }: Props) {
  const t = getDict();
  const editable = staff || (isOwner && (item.status === 'draft' || item.status === 'rejected'));
  const moves: Move[] = [
    ...(isOwner ? ownerMoves[item.status] ?? [] : []),
    ...(staff ? (staffMoves[item.status] ?? []).filter((m) => !(isOwner && ownerMoves[item.status]?.some((o) => o.to === m.to))) : []),
  ];
  const activeConsent = consents.some((c) => !c.withdrawn_at);
  const checks = [
    { ok: item.trust !== 'under_review', label: 'درجة التوثيق محددة' },
    { ok: item.rights !== 'unknown', label: 'حقوق الاستخدام محددة' },
    { ok: sources.length > 0, label: 'مصدر واحد على الأقل' },
    ...(item.trust === 'personal_testimony' ? [{ ok: activeConsent, label: 'موافقة موثقة سارية' }] : []),
  ];

  return (
    <div className={s.bench}>
      <div className={s.main}>
        <form action={updateItem.bind(null, item.id)}>
          <input type="hidden" name="return" value={mode} />
          <ItemFields item={item} staff={staff} locked={!editable} />
          {editable && <button className="btn btn-primary">احفظ التعديلات</button>}
          {!editable && <p className="notice">المادة مقفلة للتعديل في هذه الحالة.</p>}
        </form>

        <section className={s.block} aria-labelledby="sources-h">
          <h2 id="sources-h" className={s.h}>المصادر</h2>
          {sources.length === 0 ? <p className={s.empty}>لا مصادر بعد. لا تُنشر مادة بلا مصدر.</p> : (
            <ol className={s.sources}>
              {sources.map(({ sources: src, locator }) => (
                <li key={src.id}>
                  <span className={s.srcKind}>{t.sourceKind[src.kind as keyof typeof t.sourceKind]}</span>
                  <span>{src.citation}{locator && ` — ${locator}`}</span>
                  {src.url && <a href={src.url} rel="noopener noreferrer" target="_blank" dir="ltr">{new URL(src.url).hostname}</a>}
                  {editable && (
                    <form action={removeSource.bind(null, item.id, src.id)}>
                      <input type="hidden" name="return" value={mode} />
                      <button className="btn btn-quiet">أزل</button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
          )}
          {editable && (
            <details className={s.add}>
              <summary>أضف مصدراً</summary>
              <form action={addSource.bind(null, item.id)}>
                <input type="hidden" name="return" value={mode} />
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="src-kind">نوع المصدر</label>
                    <select id="src-kind" name="kind">{Object.entries(t.sourceKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </div>
                  <div className="field">
                    <label htmlFor="src-loc">الموضع <span className="hint">صفحة، دقيقة، رقم وثيقة</span></label>
                    <input id="src-loc" name="locator" type="text" maxLength={300} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="src-cit">الاستشهاد الكامل</label>
                  <textarea id="src-cit" name="citation" rows={2} minLength={3} maxLength={1000} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="src-url">الرابط <span className="hint">اختياري</span></label>
                    <input id="src-url" name="url" type="url" dir="ltr" maxLength={1000} />
                  </div>
                  <div className="field">
                    <label htmlFor="src-ref">رقم الحفظ في الأرشيف</label>
                    <input id="src-ref" name="archive_ref" type="text" maxLength={300} />
                  </div>
                </div>
                <button className="btn">أضف المصدر</button>
              </form>
            </details>
          )}
        </section>

        <section className={s.block} aria-labelledby="consent-h">
          <h2 id="consent-h" className={s.h}>الموافقة الموثقة</h2>
          {consents.length === 0 && <p className={s.empty}>لا موافقات مسجلة. الشهادة الشخصية لا تُنشر بدونها.</p>}
          <ul className={s.consents}>
            {consents.map((c) => (
              <li key={c.id}>
                <span>{c.subject_name_private}</span>
                <span className={s.meta}>{fmtDate(c.given_at)} · نص {c.consent_text_version}</span>
                {c.withdrawn_at ? <span className={s.withdrawn}>سُحبت {fmtDate(c.withdrawn_at)}</span> : (isOwner || isAdmin) && (
                  <form action={withdrawConsent.bind(null, item.id, c.id)}>
                    <input type="hidden" name="return" value={mode} />
                    <button className="btn btn-danger">اسحب الموافقة</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {(isOwner && editable) && (
            <details className={s.add}>
              <summary>سجّل موافقة صاحب الشهادة</summary>
              <form action={addConsent.bind(null, item.id)}>
                <input type="hidden" name="return" value={mode} />
                <blockquote className={s.consentText}>{CONSENT_TEXT}</blockquote>
                <div className="field">
                  <label htmlFor="c-name">اسم صاحب الشهادة <span className="hint">يبقى خاصاً، لا يظهر للعامة</span></label>
                  <input id="c-name" name="subject_name_private" type="text" minLength={2} maxLength={120} required />
                </div>
                <div className="field">
                  <label htmlFor="c-method">طريقة الموافقة</label>
                  <select id="c-method" name="method">
                    <option value="in_app_signature">إقرار داخل المنصة</option>
                    <option value="recorded_verbal">موافقة شفهية مسجلة</option>
                    <option value="paper_scan">موافقة ورقية موقعة</option>
                  </select>
                </div>
                <div className="field check">
                  <input id="c-agree" name="agree" type="checkbox" required />
                  <label htmlFor="c-agree">قرأ صاحب الشهادة النص أعلاه ووافق عليه</label>
                </div>
                <button className="btn">سجّل الموافقة</button>
              </form>
            </details>
          )}
        </section>
        {children}
      </div>

      <aside className={s.label} aria-label="لوحة المادة">
        <div className={s.badges}>
          <TrustBadge trust={item.trust} />
          {item.is_demo && <DemoTag />}
          {item.is_student_work && <span className={s.student}>عمل طالب</span>}
        </div>
        <dl className={s.dl}>
          <dt>الحالة</dt><dd><span className={`status status-${item.status}`}>{t.status[item.status]}</span></dd>
          <dt>النوع</dt><dd>{t.kind[item.kind]}</dd>
          <dt>الحقوق</dt><dd>{t.rights[item.rights]}</dd>
          <dt>آخر تعديل</dt><dd>{fmtDate(item.updated_at)}</dd>
        </dl>
        {item.status === 'rejected' && item.reject_reason && (
          <div className="notice notice-error"><strong>سبب الرفض:</strong> {item.reject_reason}</div>
        )}

        {staff && (
          <ul className={s.checks} aria-label="شروط النشر">
            {checks.map((c) => <li key={c.label} data-ok={c.ok}><span aria-hidden="true">{c.ok ? '✓' : '—'}</span> {c.label}<span className="sr-only">{c.ok ? ': مكتمل' : ': ناقص'}</span></li>)}
          </ul>
        )}

        {moves.length > 0 && (
          <div className={s.moves}>
            {moves.map((m) => (
              <form key={m.to} action={transition.bind(null, item.id)} className={s.move}>
                <input type="hidden" name="return" value={mode} />
                <input type="hidden" name="to" value={m.to} />
                {m.reason && (
                  <>
                    <label htmlFor={`r-${m.to}`} className="sr-only">السبب</label>
                    <input id={`r-${m.to}`} name="reason" type="text" placeholder="السبب (إلزامي للرفض)" required={m.to === 'rejected'} maxLength={1000} />
                  </>
                )}
                <button className={`btn ${m.danger ? 'btn-danger' : 'btn-primary'}`}>{m.label}</button>
              </form>
            ))}
          </div>
        )}

        <h2 className={s.h3}>السجل</h2>
        {events.length === 0 ? <p className={s.empty}>لا انتقالات بعد.</p> : (
          <ol className={s.events}>
            {events.map((e) => (
              <li key={e.id}>
                <span>{t.status[e.from_status as keyof typeof t.status]} ← {t.status[e.to_status as keyof typeof t.status]}</span>
                <span className={s.meta}>{fmtDate(e.at)}</span>
                {e.reason && <span className={s.reason}>{e.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
