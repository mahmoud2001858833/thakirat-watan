# ذاكرة وطن (اسم مؤقت)

أرشيف وطني حي للأردن: يضيف إليه الناس، يوثقه المختصون، ويتعلم منه الطلاب.

- [SPEC.md](SPEC.md) — المواصفات والأدوار والمراحل ومعايير القبول
- [DESIGN.md](DESIGN.md) — الاتجاه التصميمي
- [docs/SCHEMA.md](docs/SCHEMA.md) — مخطط قاعدة البيانات

## الاختبار
```bash
npm install
npm run test:db     # اختبارات RLS والصلاحيات على Postgres داخل العملية (PGlite)
npm run contrast    # التحقق من تباين الألوان
```

## المحتوى التجريبي
كل صف تجريبي يحمل `is_demo = true`. حذفه كله: `select public.admin_purge_demo();` (للمدير فقط).
