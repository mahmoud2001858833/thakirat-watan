# ذاكرة وطن (اسم مؤقت)

أرشيف وطني حي للأردن: يضيف إليه الناس، يوثقه المختصون، ويتعلم منه الطلاب.

- [SPEC.md](SPEC.md) — المواصفات والأدوار والمراحل ومعايير القبول
- [DESIGN.md](DESIGN.md) — الاتجاه التصميمي
- [docs/SCHEMA.md](docs/SCHEMA.md) — مخطط قاعدة البيانات

## التشغيل محلياً
```bash
cp .env.example .env.local   # واملأ القيم من لوحة Supabase
npm install
npm run dev
```

## الاختبار
```bash
npm run test:db     # اختبارات RLS والصلاحيات على Postgres داخل العملية (PGlite)
npm run contrast    # التحقق من تباين الألوان
npm run build && npm start -- -p 3100
E2E_CREDS=/path/outside/repo/creds.json npm run test:e2e   # سطح المكتب + الجوال + axe (WCAG AA)
```
ملف `E2E_CREDS` يحوي حسابات اختبار ولا يوضع في المستودع أبداً.

## ملاحظات أمنية
- لا يوجد مفتاح service role في التطبيق؛ كل استعلام يمر بجلسة المستخدم وRLS.
- تنبيهات Supabase Advisor المقبولة: دوال الصلاحيات (`has_role`, `is_staff`…) قابلة للاستدعاء لأنها تخص المستدعي نفسه وتحتاجها السياسات؛ الدوال الحساسة (`transition_status`, `admin_*`) تتحقق من الدور داخلها؛ `rate_limits` بلا سياسات عمداً.

## المحتوى التجريبي
كل صف تجريبي يحمل `is_demo = true`. حذفه كله: `select public.admin_purge_demo();` (للمدير فقط).
