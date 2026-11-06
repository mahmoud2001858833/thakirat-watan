import { getDict } from '@/i18n';
import type { ItemRow } from './types';

/** حقول المادة. حقول الطاقم (درجة التوثيق والحقوق) تظهر للمراجعين فقط، وتُفرض أيضاً في قاعدة البيانات. */
export function ItemFields({ item, staff, locked }: { item?: Partial<ItemRow>; staff: boolean; locked?: boolean }) {
  const t = getDict();
  return (
    <fieldset disabled={locked}>
      <div className="field">
        <label htmlFor="kind">نوع المادة</label>
        <select id="kind" name="kind" defaultValue={item?.kind ?? 'text'} required>
          {Object.entries(t.kind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="title_ar">العنوان <span className="hint">بالعربية، من حرفين إلى ٣٠٠ حرف</span></label>
        <input id="title_ar" name="title_ar" type="text" defaultValue={item?.title_ar ?? ''} minLength={2} maxLength={300} required />
      </div>
      <div className="field">
        <label htmlFor="title_en">العنوان بالإنجليزية <span className="hint">اختياري</span></label>
        <input id="title_en" name="title_en" type="text" dir="ltr" lang="en" defaultValue={item?.title_en ?? ''} maxLength={300} />
      </div>
      <div className="field">
        <label htmlFor="summary_ar">الملخص <span className="hint">ما هذه المادة، ومن أين جاءت؟</span></label>
        <textarea id="summary_ar" name="summary_ar" defaultValue={item?.summary_ar ?? ''} maxLength={2000} rows={3} />
      </div>
      <div className="field">
        <label htmlFor="body_ar">النص الكامل أو التفريغ</label>
        <textarea id="body_ar" name="body_ar" defaultValue={item?.body_ar ?? ''} rows={10} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="year_start">من سنة <span className="hint">سالب لما قبل الميلاد</span></label>
          <input id="year_start" name="year_start" type="number" inputMode="numeric" min={-2600000} max={2100} defaultValue={item?.year_start ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="year_end">إلى سنة</label>
          <input id="year_end" name="year_end" type="number" inputMode="numeric" min={-2600000} max={2100} defaultValue={item?.year_end ?? ''} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="contributor_public_name">الاسم الظاهر للمساهم <span className="hint">اتركه فارغاً لتبقى مجهول الاسم. لا يُعرض للطلاب أبداً.</span></label>
        <input id="contributor_public_name" name="contributor_public_name" type="text" maxLength={80} defaultValue={item?.contributor_public_name ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="rights_holder">صاحب الحق <span className="hint">مَن يملك هذه المادة أو صوّرها أو سجّلها؟</span></label>
        <input id="rights_holder" name="rights_holder" type="text" maxLength={300} defaultValue={item?.rights_holder ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="rights_note">ملاحظة الحقوق</label>
        <input id="rights_note" name="rights_note" type="text" maxLength={1000} defaultValue={item?.rights_note ?? ''} />
      </div>
      {staff && (
        <div className="field-row staff-only">
          <div className="field">
            <label htmlFor="trust">درجة التوثيق</label>
            <select id="trust" name="trust" defaultValue={item?.trust ?? 'under_review'}>
              {Object.entries(t.trust).filter(([k]) => k !== 'circulatedNote').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rights">حقوق الاستخدام</label>
            <select id="rights" name="rights" defaultValue={item?.rights ?? 'unknown'}>
              {Object.entries(t.rights).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}
    </fieldset>
  );
}
