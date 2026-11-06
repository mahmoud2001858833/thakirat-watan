// ترجمة رسائل قاعدة البيانات إلى عربية مفهومة
const map: [RegExp, string][] = [
  [/set trust level/, 'حدّد درجة التوثيق قبل التوثيق أو النشر.'],
  [/usage rights/, 'حدّد حقوق الاستخدام قبل التوثيق أو النشر.'],
  [/at least one source/, 'أضف مصدراً واحداً على الأقل.'],
  [/documented consent/, 'الشهادة الشخصية تحتاج موافقة موثقة سارية.'],
  [/requires a reason/, 'الرفض يحتاج سبباً واضحاً.'],
  [/not allowed/, 'هذا الإجراء غير مسموح لدورك.'],
  [/transition_status/, 'تغيير الحالة يتم من أزرار المراجعة فقط.'],
  [/row-level security|permission denied/, 'لا تملك صلاحية لهذا الإجراء.'],
  [/too many attempts/, 'محاولات كثيرة. انتظر قليلاً.'],
  [/violates check constraint/, 'بعض الحقول خارج الحدود المسموحة.'],
];
export const humanError = (m?: string | null) =>
  (m && map.find(([re]) => re.test(m))?.[1]) || 'تعذّر تنفيذ العملية. حاول مرة أخرى.';

export const okMessages: Record<string, string> = {
  saved: 'حُفظت التعديلات.',
  created: 'أُنشئت المسودة.',
  source: 'أُضيف المصدر.',
  transitioned: 'تغيّرت الحالة.',
  consent: 'سُجّلت الموافقة.',
  withdrawn: 'سُحبت الموافقة وأُخفيت المادة.',
  restored: 'استُرجعت النسخة.',
  granted: 'مُنح الدور.',
  revoked: 'سُحب الدور.',
  settings: 'حُفظت الإعدادات.',
  school: 'أُضيفت المدرسة.',
  report: 'عولج البلاغ.',
};
