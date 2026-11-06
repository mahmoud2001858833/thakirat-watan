// اختبارات RLS والصلاحيات: كل دور لا يصل إلا إلى ما يحق له.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, U = {}, schoolA, schoolB, classA;

const rows = async (uid, sql, params = []) => (await as(db, uid, () => db.query(sql, params))).rows;
const fails = async (uid, sql, params = [], re) =>
  assert.rejects(() => as(db, uid, () => db.query(sql, params)), re);

before(async () => {
  db = await freshDb();
  for (const n of ['admin', 'reviewer', 'schoolAdmin', 'teacherA', 'teacherB', 'student', 'contributor', 'other'])
    U[n] = await newUser(db, `${n}@test.local`);
  schoolA = (await db.query(`insert into public.schools (name) values ('مدرسة أ') returning id`)).rows[0].id;
  schoolB = (await db.query(`insert into public.schools (name) values ('مدرسة ب') returning id`)).rows[0].id;
  await db.query(`insert into public.user_roles (user_id, role, school_id) values
    ($1,'admin',null), ($2,'reviewer',null), ($3,'school_admin',$6), ($4,'teacher',$6), ($5,'teacher',$7)`,
    [U.admin, U.reviewer, U.schoolAdmin, U.teacherA, U.teacherB, schoolA, schoolB]);
  classA = (await rows(U.teacherA,
    `insert into public.classes (school_id, teacher_id, name, grade) values ($1,$2,'العاشر أ',10) returning id, join_code`,
    [schoolA, U.teacherA]))[0];
  await rows(U.student, `select public.join_class($1, 'نجمة الصبح')`, [classA.join_code]);
});

test('كل جدول في public عليه RLS وسياسة واحدة على الأقل', async () => {
  const r = (await db.query(`
    select c.relname, c.relrowsecurity, count(p.polname)::int as n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where ns.nspname = 'public' and c.relkind = 'r'
    group by 1, 2`)).rows;
  assert.ok(r.length >= 15);
  for (const t of r) {
    assert.equal(t.relrowsecurity, true, `RLS disabled on ${t.relname}`);
    // rate_limits مقصود بلا سياسات: الوصول عبر check_rate_limit() فقط
    if (t.relname !== 'rate_limits') assert.ok(t.n > 0, `no policies on ${t.relname}`);
  }
});

test('تطبيع العربية: الهمزات والتاء المربوطة والألف المقصورة والتشكيل', async () => {
  const n = async (s) => (await db.query('select public.ar_normalize($1) v', [s])).rows[0].v;
  assert.equal(await n('أإآٱ'), 'اااا');
  assert.equal(await n('مدرسة'), await n('مدرسه'));
  assert.equal(await n('مستشفى'), 'مستشفي');
  assert.equal(await n('مُحَمَّـــد'), 'محمد');
  assert.equal(await n('مسؤول'), 'مسوول');
  assert.equal(await n('١٩٤٦'), '1946');
});

test('المستخدم الجديد يحصل على ملف ودور مساهم فقط', async () => {
  const r = await rows(U.other, `select role from public.user_roles where user_id = auth.uid()`);
  assert.deepEqual(r.map((x) => x.role), ['contributor']);
  assert.equal((await rows(U.other, `select count(*)::int n from public.profiles`))[0].n, 1, 'sees only own profile');
});

test('لا تصعيد للصلاحيات', async () => {
  await fails(U.contributor, `insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')`, [], /row-level security/);
  await fails(U.schoolAdmin, `insert into public.user_roles (user_id, role) values ($1, 'reviewer')`, [U.other], /row-level security/);
  await fails(U.schoolAdmin, `insert into public.user_roles (user_id, role, school_id) values ($1, 'teacher', $2)`, [U.other, schoolB], /row-level security/);
  await rows(U.schoolAdmin, `insert into public.user_roles (user_id, role, school_id) values ($1, 'teacher', $2)`, [U.other, schoolA]);
  await fails(U.teacherA, `insert into public.user_roles (user_id, role, school_id) values ($1, 'teacher', $2)`, [U.contributor, schoolA], /row-level security/);
});

test('دورة مراجعة المادة كاملة، والمساهم لا ينشر بنفسه', async () => {
  const [it] = await rows(U.contributor, `insert into public.items (kind, title_ar, status, trust, is_demo)
    values ('text', 'رواية عن سوق السلط', 'published', 'official_document', true) returning id, status, trust, is_demo`);
  assert.equal(it.status, 'draft'); assert.equal(it.trust, 'under_review'); assert.equal(it.is_demo, false);

  await fails(U.contributor, `update public.items set status = 'published' where id = $1`, [it.id], /transition_status/);
  assert.equal((await rows(null, `select * from public.items where id = $1`, [it.id])).length, 0, 'anon cannot see draft');
  assert.equal((await rows(U.other, `select * from public.items where id = $1`, [it.id])).length, 0, 'others cannot see draft');

  await rows(U.contributor, `select public.transition_status($1, 'in_review')`, [it.id]);
  await fails(U.contributor, `select public.transition_status($1, 'verified')`, [it.id], /not allowed/);
  assert.equal((await rows(U.contributor, `update public.items set title_ar = 'تعديل بعد الإرسال' where id = $1 returning id`, [it.id])).length, 0,
    'cannot edit while in review');

  await fails(U.reviewer, `select public.transition_status($1, 'verified')`, [it.id], /trust level/);
  await rows(U.reviewer, `update public.items set trust = 'personal_testimony', rights = 'permission' where id = $1`, [it.id]);
  await fails(U.reviewer, `select public.transition_status($1, 'verified')`, [it.id], /source/);
  const [src] = await rows(U.reviewer, `insert into public.sources (kind, citation) values ('person', 'مقابلة مسجلة، 2026') returning id`);
  await rows(U.reviewer, `insert into public.item_sources (item_id, source_id) values ($1, $2)`, [it.id, src.id]);
  await fails(U.reviewer, `select public.transition_status($1, 'verified')`, [it.id], /consent/);
  await rows(U.reviewer, `select public.transition_status($1, 'rejected', $2)`, [it.id, 'بانتظار موافقة الراوي']);
  assert.equal((await rows(U.contributor, `select reject_reason r from public.items where id = $1`, [it.id]))[0].r, 'بانتظار موافقة الراوي');
  await fails(U.reviewer, `select public.transition_status($1, 'rejected', '  ')`, [it.id], /not allowed|reason/);

  // المساهم يعيد للمسودة ويضيف الموافقة
  await rows(U.contributor, `select public.transition_status($1, 'draft')`, [it.id]);
  const [c] = await rows(U.contributor, `insert into public.consents (item_id, subject_name_private, consent_text_version, consent_text, method)
     values ($1, 'الراوي', 'v1', 'أوافق على النشر', 'in_app_signature') returning id`, [it.id]);
  await rows(U.contributor, `select public.transition_status($1, 'in_review')`, [it.id]);
  await rows(U.reviewer, `select public.transition_status($1, 'verified')`, [it.id]);
  await rows(U.reviewer, `select public.transition_status($1, 'published')`, [it.id]);

  assert.equal((await rows(null, `select * from public.items where id = $1`, [it.id])).length, 1, 'anon sees published');
  assert.equal((await rows(null, `select * from public.sources where id = $1`, [src.id])).length, 1, 'anon sees its source');
  assert.equal((await rows(null, `select * from public.consents`)).length, 0, 'consents never public');
  assert.equal((await rows(U.other, `select * from public.consents`)).length, 0);

  // سجل المراجعة والتدقيق
  assert.ok((await rows(U.contributor, `select * from public.review_events where item_id = $1`, [it.id])).length >= 6);
  assert.equal((await rows(U.reviewer, `select * from public.audit_log`)).length, 0, 'reviewer cannot read audit');
  assert.ok((await rows(U.admin, `select * from public.audit_log where action = 'transition'`)).length >= 6);

  // سحب الموافقة يخفي المادة فوراً
  await fails(U.other, `select public.withdraw_consent($1)`, [c.id], /not allowed/);
  await rows(U.contributor, `select public.withdraw_consent($1, 'غيّرت رأيي')`, [c.id]);
  assert.equal((await rows(null, `select * from public.items where id = $1`, [it.id])).length, 0, 'hidden after withdrawal');
  assert.equal((await rows(U.reviewer, `select status from public.items where id = $1`, [it.id]))[0].status, 'archived');
});

test('حماية القاصرين: عمل الطالب مجهول الاسم، يراه معلمه فقط، ولا يُنشر دون مراجعة', async () => {
  const [it] = await rows(U.student, `insert into public.items (kind, title_ar, contributor_public_name)
    values ('text', 'بحث عن قلعة عجلون', 'اسم حقيقي') returning id, is_student_work, contributor_public_name`);
  assert.equal(it.is_student_work, true);
  assert.equal(it.contributor_public_name, null);
  await rows(U.student, `select public.transition_status($1, 'in_review')`, [it.id]);
  await fails(U.student, `select public.transition_status($1, 'published')`, [it.id], /not allowed/);
  await fails(U.teacherA, `select public.transition_status($1, 'published')`, [it.id], /not allowed/);

  assert.equal((await rows(U.teacherA, `select * from public.items where id = $1`, [it.id])).length, 1, 'own teacher sees');
  assert.equal((await rows(U.teacherB, `select * from public.items where id = $1`, [it.id])).length, 0, 'other teacher does not');
  assert.equal((await rows(null, `select * from public.items where id = $1`, [it.id])).length, 0, 'public does not');

  assert.equal((await rows(U.teacherA, `select * from public.class_members`)).length, 1);
  assert.equal((await rows(U.schoolAdmin, `select * from public.class_members`)).length, 1);
  assert.equal((await rows(U.teacherB, `select * from public.class_members`)).length, 0);
  assert.equal((await rows(null, `select * from public.class_members`)).length, 0);
  assert.equal((await rows(null, `select * from public.classes`)).length, 0);
  assert.equal((await rows(U.teacherB, `select * from public.classes`)).length, 0);
  assert.equal((await rows(U.student, `select is_minor from public.profiles where id = auth.uid()`))[0].is_minor, true);
  // الطالب لا يستطيع رفع حالته أو إخفاء أنه طالب
  await rows(U.student, `update public.items set is_student_work = false where id = $1`, [it.id]);
  assert.equal((await rows(U.admin, `select is_student_work from public.items where id = $1`, [it.id]))[0].is_student_work, true);
});

test('الإعدادات: الزائر يقرأ العامة، والمدير وحده يعدّل، والتعديل يُدقَّق', async () => {
  assert.equal((await rows(null, `select value from public.settings where key = 'assistant.enabled'`))[0].value, false);
  assert.equal((await rows(U.reviewer, `update public.settings set value = 'true' where key = 'assistant.enabled' returning key`)).length, 0);
  await rows(U.admin, `update public.settings set value = 'true' where key = 'assistant.enabled'`);
  assert.equal((await rows(null, `select value from public.settings where key = 'assistant.enabled'`))[0].value, true);
  assert.ok((await rows(U.admin, `select * from public.audit_log where table_name = 'settings'`)).length >= 1);
});

test('سجل التدقيق غير قابل للعبث', async () => {
  await fails(U.admin, `delete from public.audit_log`, [], /permission denied/);
  await fails(U.admin, `insert into public.audit_log (action) values ('fake')`, [], /permission denied/);
  await fails(U.contributor, `select public.audit('x', null, null, null)`, [], /permission denied/);
  await fails(null, `select * from public.rate_limits`, [], /permission denied/);
});

test('البلاغات: الزائر يبلّغ عن مادة منشورة، ولا يرى البلاغات', async () => {
  const [pub] = await db.query(`insert into public.items (kind, title_ar, status, trust, rights)
    values ('image','صورة لمدرج عمان الروماني','published','official_document','public_domain') returning id`).then((r) => r.rows);
  await rows(null, `insert into public.reports (item_id, reason, reporter_id) values ($1, 'inaccurate', null)`, [pub.id]);
  assert.equal((await rows(null, `select * from public.reports`)).length, 0);
  assert.equal((await rows(U.reviewer, `select * from public.reports`)).length, 1);
});

test('البحث العربي يتجاوز اختلاف الهمزات والتاء المربوطة', async () => {
  await db.query(`insert into public.items (kind, title_ar, status, trust, rights) values
    ('document','مدرسة السلط الثانوية','published','official_document','public_domain'),
    ('document','الأردن في الصحافة','published','official_document','public_domain'),
    ('document','مسودة غير منشورة عن السلط','draft','under_review','unknown')`);
  const s = async (q) => (await rows(null, `select title_ar from public.search_items($1)`, [q])).map((r) => r.title_ar);
  assert.ok((await s('مدرسه')).includes('مدرسة السلط الثانوية'));
  assert.ok((await s('الاردن')).includes('الأردن في الصحافة'));
  assert.ok(!(await s('السلط')).some((t) => t.startsWith('مسودة')), 'drafts never in search');
});

test('النسخ قابلة للاسترجاع', async () => {
  const [it] = (await db.query(`insert into public.items (kind, title_ar) values ('text','العنوان الأول') returning id`)).rows;
  await db.query(`update public.items set title_ar = 'العنوان الثاني' where id = $1`, [it.id]);
  const [v] = await rows(U.reviewer, `select id from public.content_versions where item_id = $1 order by id desc limit 1`, [it.id]);
  await fails(U.contributor, `select public.admin_restore_version($1)`, [v.id], /not allowed/);
  await rows(U.reviewer, `select public.admin_restore_version($1)`, [v.id]);
  assert.equal((await db.query(`select title_ar from public.items where id = $1`, [it.id])).rows[0].title_ar, 'العنوان الأول');
});

test('حذف المحتوى التجريبي بأمر واحد، للمدير فقط', async () => {
  await db.query(`insert into public.items (kind, title_ar, is_demo) values ('text','مادة تجريبية', true)`);
  await db.query(`insert into public.places (kind, name_ar, is_demo) values ('site','موقع تجريبي', true)`);
  await fails(U.reviewer, `select public.admin_purge_demo()`, [], /not allowed/);
  await fails(null, `select public.admin_purge_demo()`, [], /permission denied/);
  const r = (await rows(U.admin, `select public.admin_purge_demo() r`))[0].r;
  assert.equal(r.items, 1); assert.equal(r.places, 1);
  assert.equal((await db.query(`select count(*)::int n from public.items where is_demo`)).rows[0].n, 0);
});

test('حد المعدل يمنع تخمين رموز الصفوف', async () => {
  for (let i = 0; i < 10; i++)
    assert.equal((await rows(U.other, `select public.join_class($1, 'اسم') c`, ['WRONG' + i]))[0].c, null);
  await fails(U.other, `select public.join_class($1, 'اسم')`, [classA.join_code], /too many attempts/);
  assert.equal((await rows(U.other, `select count(*)::int n from public.class_members`))[0].n, 0);
});
