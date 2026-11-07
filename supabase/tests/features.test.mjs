// اختبارات الميزات الخمس: الصلاحيات والنمو والمراجعة
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db, U = {}, gov = {}, school, cls;
const rows = async (uid, sql, params = []) => (await as(db, uid, () => db.query(sql, params))).rows;
const fails = async (uid, sql, params = [], re) => assert.rejects(() => as(db, uid, () => db.query(sql, params)), re);

before(async () => {
  db = await freshDb();
  for (const n of ['admin', 'reviewer', 'teacher', 'student', 'user', 'other']) U[n] = await newUser(db, `${n}@t.local`);
  for (const r of (await db.query(`select key, id from public.places where kind = 'governorate'`)).rows) gov[r.key] = r.id;
  school = (await db.query(`insert into public.schools (name) values ('مدرسة') returning id`)).rows[0].id;
  await db.query(`insert into public.user_roles (user_id, role, school_id) values ($1,'admin',null),($2,'reviewer',null),($3,'teacher',$4)`,
    [U.admin, U.reviewer, U.teacher, school]);
  cls = (await rows(U.teacher, `insert into public.classes (school_id, teacher_id, name) values ($1,$2,'صف') returning join_code`, [school, U.teacher]))[0];
  await rows(U.student, `select public.join_class($1, 'نجمة')`, [cls.join_code]);
});

test('المحافظات الاثنتا عشرة موجودة', () => assert.equal(Object.keys(gov).length, 12));

test('الورقة تبدأ برعماً لصاحبها فقط، وتظهر للعامة بعد المراجعة', async () => {
  const [leaf] = await rows(U.user, `insert into public.olive_leaves (body, governorate_id, display_name, status, is_demo)
    values ('ذكرى من عجلون', $1, 'محمود أحمد الكامل', 'published', true) returning id, status, display_name`, [gov.ajloun]);
  assert.equal(leaf.status, 'pending'); assert.equal(leaf.display_name, 'محمود', 'الاسم الأول فقط');
  assert.equal((await rows(null, `select id from public.olive_leaves where id = $1`, [leaf.id])).length, 0);
  assert.equal((await rows(U.other, `select id from public.olive_leaves where id = $1`, [leaf.id])).length, 0);
  assert.equal((await rows(U.user, `select id from public.olive_leaves where id = $1`, [leaf.id])).length, 1, 'برعم لصاحبه');
  await fails(U.user, `update public.olive_leaves set status = 'published' where id = $1`, [leaf.id], /permission denied/);
  await fails(U.user, `select public.review_leaf($1, true)`, [leaf.id], /not allowed/);
  await fails(U.reviewer, `select public.review_leaf($1, false, '')`, [leaf.id], /reason/);
  await rows(U.reviewer, `select public.review_leaf($1, true)`, [leaf.id]);
  assert.equal((await rows(null, `select body from public.olive_leaves where id = $1`, [leaf.id]))[0].body, 'ذكرى من عجلون');
  // لا يُكشف صاحب الورقة
  await fails(null, `select author_id from public.olive_leaves`, [], /permission denied/);
  await fails(U.other, `select reviewed_by from public.olive_leaves`, [], /permission denied/);
});

test('ورقة الطالب باسمه المستعار ومدرسته، ولا تُنشر قبل المراجعة', async () => {
  const [l] = await rows(U.student, `insert into public.olive_leaves (body, governorate_id, display_name) values ('من صفنا', $1, 'اسم حقيقي كامل') returning id, display_name, school_id, status`, [gov.irbid]);
  assert.equal(l.display_name, 'نجمة'); assert.equal(l.school_id, school); assert.equal(l.status, 'pending');
  assert.equal((await rows(null, `select id from public.olive_leaves where id = $1`, [l.id])).length, 0);
});

test('حد المعدل: عشر أوراق يومياً لكل مستخدم', async () => {
  for (let i = 0; i < 9; i++) await rows(U.other, `insert into public.olive_leaves (body, governorate_id) values ($1, $2)`, [`ورقة ${i}`, gov.karak]);
  await rows(U.other, `insert into public.olive_leaves (body, governorate_id) values ('العاشرة', $1)`, [gov.karak]);
  await fails(U.other, `insert into public.olive_leaves (body, governorate_id) values ('الحادية عشرة', $1)`, [gov.karak], /too many/);
});

test('نمو الشجرة يُحسب في القاعدة', async () => {
  // 1050 ورقة منشورة تجريبية مباشرة (بصلاحية النظام)
  await db.query(`insert into public.olive_leaves (body, governorate_id, status, is_demo, author_id)
    select 'ورقة ' || g, $1, 'published', true, null from generate_series(1, 1050) g`, [gov.amman]);
  const s = (await rows(null, `select public.olive_state() s`))[0].s;
  assert.ok(s.total >= 1051); assert.equal(s.branches, Math.floor(s.total / 100));
  assert.equal(s.blooming, true); assert.equal(s.golden, false);
  assert.ok(s.by_governorate[gov.amman] >= 1050);
  assert.ok(['spring', 'summer', 'autumn', 'winter'].includes(s.season));
});

test('مختبر الترميم: اللوحة المنشورة فقط، والإكمال عبر الدالة', async () => {
  await db.query(`insert into public.mosaics (slug, title_ar, summary_ar, image_path, credit, license, source_url, published)
    values ('a','أ','ملخص','/x.jpg','x','CC BY','https://x', true), ('b','ب','ملخص','/y.jpg','y','CC BY','https://y', false)`);
  assert.deepEqual((await rows(null, `select slug from public.mosaics order by slug`)).map((r) => r.slug), ['a']);
  await fails(null, `insert into public.mosaic_completions (mosaic_id, moves, seconds) select id, 1, 1 from public.mosaics`, [], /permission denied/);
  await rows(null, `select public.record_mosaic_completion('a', 40, 90)`);
  await rows(null, `select public.record_mosaic_completion('b', 40, 90)`);
  assert.equal((await rows(null, `select * from public.mosaic_completions`)).length, 0, 'لا يقرأ الزائر الإحصاءات');
  assert.equal((await rows(U.reviewer, `select * from public.mosaic_completions`)).length, 1, 'غير المنشورة لا تُسجَّل');
});

test('حروف الخطوط: قراءة عامة وتعديل للطاقم فقط', async () => {
  await db.query(`insert into public.script_letters (script, position, arabic, codepoint, name, translit) values ('safaitic', 1, 'ه', 68224, 'OLD NORTH ARABIAN LETTER HEH', 'h')`);
  assert.equal((await rows(null, `select * from public.script_letters`)).length, 1);
  assert.equal((await rows(U.user, `update public.script_letters set note_ar = 'x' returning id`)).length, 0);
  assert.equal((await rows(U.reviewer, `update public.script_letters set note_ar = 'ملاحظة' returning id`)).length, 1);
});

test('هذا اليوم: الأحداث المنشورة فقط لذلك اليوم', async () => {
  await db.query(`insert into public.items (kind, title_ar, status, trust, is_event, date_exact, date_precision) values
    ('text','حدث منشور','published','under_review',true,'1946-05-25','day'),
    ('text','حدث مسودة','draft','under_review',true,'1950-05-25','day'),
    ('text','حدث آخر','published','under_review',true,'1946-05-26','day')`);
  const r = await rows(null, `select title_ar from public.this_day(5, 25)`);
  assert.deepEqual(r.map((x) => x.title_ar), ['حدث منشور']);
  assert.ok((await rows(null, `select * from public.event_days()`)).some((x) => x.m === 5 && x.d === 26));
});

test('حذف التجريبي يشمل الأوراق ويُبقي الحقيقي', async () => {
  const before = (await db.query(`select count(*)::int n from public.olive_leaves where not is_demo`)).rows[0].n;
  const r = (await rows(U.admin, `select public.admin_purge_demo() r`))[0].r;
  assert.ok(r.leaves >= 1050);
  assert.equal((await db.query(`select count(*)::int n from public.olive_leaves where is_demo`)).rows[0].n, 0);
  assert.equal((await db.query(`select count(*)::int n from public.olive_leaves where not is_demo`)).rows[0].n, before);
  assert.equal(Object.keys(gov).length, (await db.query(`select count(*)::int n from public.places where kind='governorate'`)).rows[0].n);
});
