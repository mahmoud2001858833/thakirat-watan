// الميزات التشاركية: حسابات الطلاب، والتوأمة، والجلسة المباشرة، والفسيفساء الكبرى — بالصلاحيات الحقيقية (RLS)
// مدرستان في محافظتين بعيدتين، ومعلمان، وأربعة طلاب، ومستخدم من خارج الصفين.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, newUser } from './harness.mjs';

let db; const U = {}; const S = {}; let gov = {}, schoolA, schoolB, classA, classB, twin, q1;
const rows = async (uid, sql, params = []) => (await as(db, uid, () => db.query(sql, params))).rows;
const one = async (uid, sql, params = []) => (await rows(uid, sql, params))[0];
const fails = async (uid, sql, params = [], re) => assert.rejects(() => as(db, uid, () => db.query(sql, params)), re);

before(async () => {
  db = await freshDb();
  for (const n of ['admin', 'teacherA', 'teacherB', 'outsider', 'teacherC']) U[n] = await newUser(db, `${n}@t.local`);
  for (const r of (await db.query(`select key, id from public.places where kind = 'governorate'`)).rows) gov[r.key] = r.id;
  schoolA = (await db.query(`insert into public.schools (name, place_id, public_listing) values ('مدرسة إربد', $1, true) returning id`, [gov.irbid])).rows[0].id;
  schoolB = (await db.query(`insert into public.schools (name, place_id, public_listing) values ('مدرسة العقبة السرية', $1, false) returning id`, [gov.aqaba])).rows[0].id;
  const schoolC = (await db.query(`insert into public.schools (name, place_id) values ('مدرسة إربد الثانية', $1) returning id`, [gov.irbid])).rows[0].id;
  await db.query(`insert into public.user_roles (user_id, role, school_id) values ($1,'admin',null),($2,'teacher',$3),($4,'teacher',$5),($6,'teacher',$7)`,
    [U.admin, U.teacherA, schoolA, U.teacherB, schoolB, U.teacherC, schoolC]);
  classA = (await one(U.teacherA, `insert into public.classes (school_id, teacher_id, name, grade) values ($1,$2,'السابع أ',7) returning id`, [schoolA, U.teacherA])).id;
  classB = (await one(U.teacherB, `insert into public.classes (school_id, teacher_id, name, grade) values ($1,$2,'السابع ب',7) returning id`, [schoolB, U.teacherB])).id;
  S.classC = (await one(U.teacherC, `insert into public.classes (school_id, teacher_id, name) values ($1,$2,'صف ثالث') returning id`, [schoolC, U.teacherC])).id;
});

test('المعلم ينشئ طلاباً بأسماء مستعارة ورموز دخول، بلا بريد حقيقي', async () => {
  const a = await rows(U.teacherA, `select * from public.teacher_add_students($1, array['غزال','صقر'])`, [classA]);
  const b = await rows(U.teacherB, `select * from public.teacher_add_students($1, array['مرجان','نورس'])`, [classB]);
  assert.equal(a.length, 2); assert.match(a[0].code, /^[A-Z2-9]{5}-[A-Z2-9]{6}$/);
  for (const [k, r] of [['s1', a[0]], ['s2', a[1]], ['s3', b[0]], ['s4', b[1]]]) {
    const m = (await db.query(`select student_id from public.class_members where id = $1`, [r.member_id])).rows[0];
    S[k] = { uid: m.student_id, member: r.member_id, code: r.code, name: r.pseudonym };
  }
  // كلمة السر مُجزّأة bcrypt وتطابق الرمز، والبريد مصطنع غير قابل للتسليم
  const u = (await db.query(`select email, encrypted_password = extensions.crypt($2, encrypted_password) ok from auth.users where id = $1`, [S.s1.uid, S.s1.code])).rows[0];
  assert.equal(u.ok, true); assert.match(u.email, /@students\.thakirat-watan\.example$/);
  assert.ok(!u.email.includes('غزال'));
  // الطالب ليس مساهماً عاماً، وهو قاصر
  const roles = (await db.query(`select role from public.user_roles where user_id = $1`, [S.s1.uid])).rows.map((r) => r.role);
  assert.deepEqual(roles, ['student']);
  assert.equal((await db.query(`select is_minor from public.profiles where id = $1`, [S.s1.uid])).rows[0].is_minor, true);
  // معلم آخر أو طالب أو زائر لا يضيفون طلاباً إلى صف ليس لهم
  await fails(U.teacherB, `select * from public.teacher_add_students($1, array['دخيل'])`, [classA], /not allowed/);
  await fails(S.s1.uid, `select * from public.teacher_add_students($1, array['دخيل'])`, [classA], /not allowed/);
  await fails(null, `select * from public.teacher_add_students($1, array['دخيل'])`, [classA], /permission denied/);
  await fails(U.teacherA, `select * from public.teacher_add_students($1, array['a'])`, [classA], /2-40/);
  // إعادة الرمز تُبطل القديم
  const fresh = (await one(U.teacherA, `select public.teacher_reset_code($1) c`, [S.s2.member])).c;
  const chk = (await db.query(`select encrypted_password = extensions.crypt($2, encrypted_password) ok from auth.users where id = $1`, [S.s2.uid, S.s2.code])).rows[0];
  assert.equal(chk.ok, false); S.s2.code = fresh;
  await fails(U.teacherB, `select public.teacher_reset_code($1)`, [S.s2.member], /not allowed/);
});

test('الطالب لا يرى إلا زملاء صفه بأسمائهم المستعارة، ولا يرى صفاً آخر', async () => {
  const mates = await rows(S.s1.uid, `select pseudonym from public.my_classmates($1)`, [classA]);
  assert.deepEqual(mates.map((x) => x.pseudonym).sort(), ['صقر', 'غزال'].sort());
  assert.equal((await rows(S.s1.uid, `select * from public.my_classmates($1)`, [classB])).length, 0);
  assert.equal((await rows(S.s1.uid, `select * from public.class_members`)).length, 1, 'عضويته فقط');
  assert.equal((await rows(S.s3.uid, `select id from public.classes where id = $1`, [classA])).length, 0);
  assert.equal((await rows(U.outsider, `select * from public.class_members`)).length, 0);
  const me = await one(S.s1.uid, `select * from public.my_class()`);
  assert.equal(me.pseudonym, 'غزال'); assert.equal(me.class_id, classA);
});

test('التوأمة: بين محافظتين فقط، يقترحها معلم ويقبلها الآخر، والطلاب لا يقترحون', async () => {
  await db.query(`update public.classes set open_for_twinning = true where id in ($1, $2, $3)`, [classA, classB, S.classC]);
  const dir = await rows(U.teacherA, `select * from public.twin_directory()`);
  const bRow = dir.find((d) => d.class_id === classB);
  assert.ok(bRow); assert.equal(bRow.school, 'مدرسة في العقبة', 'اسم المدرسة غير الموافقة لا يظهر');
  assert.equal((await rows(S.s1.uid, `select * from public.twin_directory()`)).length, 0, 'الطالب لا يرى الدليل');
  await fails(U.teacherA, `select public.twin_propose($1, $2)`, [classA, S.classC], /another governorate/);
  await fails(S.s1.uid, `select public.twin_propose($1, $2)`, [classA, classB], /not allowed/);
  twin = (await one(U.teacherA, `select public.twin_propose($1, $2) t`, [classA, classB])).t;
  await fails(U.teacherA, `select public.twin_respond($1, true)`, [twin], /not allowed/);
  await fails(S.s3.uid, `select public.twin_respond($1, true)`, [twin], /not allowed/);
  assert.equal((await one(U.teacherB, `select public.twin_respond($1, true) s`, [twin])).s, 'active');
  await fails(U.teacherA, `insert into public.twinnings (class_a, class_b) values ($1, $2)`, [classA, S.classC], /permission denied/);
  const mine = await rows(S.s1.uid, `select * from public.my_twinnings()`);
  assert.equal(mine.length, 1); assert.equal(mine[0].their_gov, 'العقبة'); assert.ok(mine[0].their_lat < mine[0].my_lat);
  assert.equal((await rows(U.outsider, `select * from public.my_twinnings()`)).length, 0);
});

test('صندوق الرسائل: لا يرى الصف التوأم شيئاً قبل موافقة معلم الكاتب، ولا رسائل خاصة', async () => {
  q1 = (await one(S.s1.uid, `select public.twin_post($1, 'question', 'ما أشهر أكلة في العقبة؟') id`, [twin])).id;
  const vis = async (uid) => (await rows(uid, `select id from public.twin_messages where id = $1`, [q1])).length;
  assert.equal(await vis(S.s1.uid), 1, 'الكاتب يرى رسالته');
  assert.equal(await vis(U.teacherA), 1, 'معلمه يراها');
  for (const who of [S.s2.uid, S.s3.uid, S.s4.uid, U.teacherB, U.outsider, null]) assert.equal(await vis(who), 0, 'لا أحد غيرهما قبل المراجعة');
  // لا كتابة مباشرة ولا تعديل للحالة
  await fails(S.s1.uid, `update public.twin_messages set status = 'approved' where id = $1`, [q1], /permission denied/);
  await fails(S.s1.uid, `insert into public.twin_messages (twinning_id, from_class, author_member, kind, body) values ($1,$2,$3,'question','x y')`, [twin, classA, S.s1.member], /permission denied/);
  await fails(S.s1.uid, `select public.twin_review($1, true)`, [q1], /not allowed/);
  await fails(U.teacherB, `select public.twin_review($1, true)`, [q1], /not allowed/);
  await fails(U.teacherA, `select public.twin_review($1, false, '')`, [q1], /reason/);
  // لا جواب على سؤال غير معتمد
  await fails(S.s3.uid, `select public.twin_post($1, 'answer', 'السيادية', $2)`, [twin, q1], /approved question/);
  await rows(U.teacherA, `select public.twin_review($1, true)`, [q1]);
  for (const who of [S.s2.uid, S.s3.uid, S.s4.uid, U.teacherB]) assert.equal(await vis(who), 1, 'بعد الموافقة يراها الصفان');
  assert.equal(await vis(U.outsider), 0); assert.equal(await vis(null), 0);
  // الجواب من التوأم يمر بمعلمه هو
  const a1 = (await one(S.s3.uid, `select public.twin_post($1, 'answer', 'الصيادية: سمك وأرز', $2) id`, [twin, q1])).id;
  assert.equal((await rows(S.s1.uid, `select id from public.twin_messages where id = $1`, [a1])).length, 0);
  assert.equal((await rows(U.teacherA, `select id from public.twin_messages where id = $1`, [a1])).length, 0, 'معلم الصف الآخر لا يرى قبل المراجعة');
  await fails(U.teacherA, `select public.twin_review($1, true)`, [a1], /not allowed/);
  await rows(U.teacherB, `select public.twin_review($1, true)`, [a1]);
  assert.equal((await rows(S.s1.uid, `select id from public.twin_messages where id = $1`, [a1])).length, 1);
  // الصف لا يجيب نفسه، والدخيل لا يكتب
  await fails(S.s2.uid, `select public.twin_post($1, 'answer', 'جواب من صفنا', $2)`, [twin, q1], /approved question/);
  await fails(U.outsider, `select public.twin_post($1, 'question', 'مرحبا هنا')`, [twin], /not allowed/);
  // رسالة المعلم تُعتمد مباشرة
  const tq = await one(U.teacherB, `select public.twin_post($1, 'question', 'ما المعلم الأقدم في إربد؟') id`, [twin]);
  assert.equal((await rows(S.s1.uid, `select status from public.twin_messages where id = $1`, [tq.id]))[0].status, 'approved');
  // الرسائل بين صفين لا إلى طالب: لا عمود للمستلم أصلاً
  const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='twin_messages'`)).rows.map((r) => r.column_name);
  assert.ok(!cols.some((c) => /recipient|to_member|to_user/.test(c)));
});

test('الوسائط: صاحب الرسالة المعلّقة فقط يرفق ملفاً، وبمسار رسالته', async () => {
  const m = (await one(S.s2.uid, `select public.twin_post($1, 'question', 'صورة من سوق إربد القديم') id`, [twin])).id;
  const path = `${twin}/${m}/${crypto.randomUUID()}.jpg`;
  await fails(S.s1.uid, `select public.twin_attach($1,'image',$2,'image/jpeg',1000,10,10,null,'سوق')`, [m, path], /not allowed/);
  await fails(S.s2.uid, `select public.twin_attach($1,'image',$2,'image/jpeg',1000,10,10,null,'سوق')`, [m, `${twin}/other/${crypto.randomUUID()}.jpg`], /bad path/);
  await rows(S.s2.uid, `select public.twin_attach($1,'image',$2,'image/jpeg',1000,10,10,null,'سوق')`, [m, path]);
  assert.equal((await rows(S.s3.uid, `select id from public.twin_media`)).filter(Boolean).length, 0, 'الصف التوأم لا يرى الملف قبل المراجعة');
  await rows(U.teacherA, `select public.twin_review($1, true)`, [m]);
  assert.equal((await rows(S.s3.uid, `select path from public.twin_media`))[0].path, path);
  await fails(S.s2.uid, `select public.twin_attach($1,'image',$2,'image/jpeg',1000,10,10,null,'x')`, [m, `${twin}/${m}/${crypto.randomUUID()}.jpg`], /not allowed/);
});

test('الجلسة المباشرة: طلاب الصف فقط، والنصوص لا تظهر على الشاشة قبل موافقة المعلم', async () => {
  const s = await one(U.teacherA, `select * from public.live_open($1, 'الخزنة')`, [classA]);
  assert.match(s.code, /^\d{6}$/);
  await fails(U.teacherB, `select * from public.live_open($1, 'x')`, [classA], /not allowed/);
  const acts = await rows(U.teacherA, `insert into public.live_activities (session_id, idx, kind, prompt, options) values
    ($1, 0, 'poll', 'من نحت الخزنة؟', '["الأنباط","الرومان","المماليك"]'), ($1, 1, 'text', 'ماذا تلاحظ؟', '[]'), ($1, 2, 'pin', 'أين الجرة؟', '[]') returning id, idx`, [s.id]);
  const [poll, txt, pin] = acts.sort((a, b) => a.idx - b.idx).map((a) => a.id);
  await fails(S.s1.uid, `insert into public.live_activities (session_id, idx, kind, prompt) values ($1, 5, 'poll', 'خطأ')`, [s.id], /row-level security/);
  assert.equal((await one(S.s3.uid, `select public.live_join($1) id`, [s.code])).id, null, 'طالب الصف الآخر لا يدخل');
  assert.equal((await one(U.outsider, `select public.live_join($1) id`, [s.code])).id, null);
  assert.equal((await one(S.s1.uid, `select public.live_join($1) id`, [s.code])).id, s.id);
  assert.equal((await rows(S.s3.uid, `select id from public.live_sessions where id = $1`, [s.id])).length, 0);
  await rows(S.s1.uid, `select public.live_respond($1, 0)`, [poll]);
  await rows(S.s2.uid, `select public.live_respond($1, 0)`, [poll]);
  await rows(S.s1.uid, `select public.live_respond($1, 1)`, [poll]); // يغيّر رأيه
  await fails(S.s1.uid, `select public.live_respond($1, 9)`, [poll], /bad choice/);
  await fails(S.s1.uid, `select public.live_respond($1, null, 'مبكراً')`, [txt], /not open/);
  await fails(S.s3.uid, `select public.live_respond($1, 0)`, [poll], /not allowed/);
  const r = (await one(S.s2.uid, `select public.live_results($1) r`, [poll])).r;
  assert.deepEqual(r.votes.sort((a, b) => a.choice - b.choice), [{ choice: 0, n: 1 }, { choice: 1, n: 1 }]);
  assert.equal(r.answered, 2); assert.equal(r.class_size, 2);
  assert.equal((await one(S.s3.uid, `select public.live_results($1) r`, [poll])).r, null);
  assert.equal((await rows(S.s2.uid, `select * from public.live_responses`)).length, 1, 'الطالب يرى إجابته فقط');
  // الطالب لا يتحكم بالجلسة
  await rows(S.s1.uid, `update public.live_sessions set current = 1 where id = $1`, [s.id]);
  assert.equal((await db.query(`select current from public.live_sessions where id = $1`, [s.id])).rows[0].current, 0);
  await rows(U.teacherA, `update public.live_sessions set current = 1 where id = $1`, [s.id]);
  const resp = (await one(S.s1.uid, `select public.live_respond($1, null, 'النقوش دقيقة جداً') id`, [txt])).id;
  assert.equal((await one(S.s2.uid, `select public.live_results($1) r`, [txt])).r.texts.length, 0, 'النص مخفي حتى يظهره المعلم');
  await rows(S.s1.uid, `update public.live_responses set shown = true where id = $1`, [resp]);
  assert.equal((await one(S.s2.uid, `select public.live_results($1) r`, [txt])).r.texts.length, 0, 'الطالب لا يُظهر نصه بنفسه');
  await rows(U.teacherA, `update public.live_responses set shown = true where id = $1`, [resp]);
  const t2 = (await one(S.s2.uid, `select public.live_results($1) r`, [txt])).r.texts;
  assert.equal(t2.length, 1); assert.equal(t2[0].by, 'غزال', 'بالاسم المستعار');
  await rows(U.teacherA, `update public.live_sessions set current = 2 where id = $1`, [s.id]);
  for (let i = 0; i < 5; i++) await rows(S.s2.uid, `select public.live_respond($1, null, null, $2, 0.5)`, [pin, i / 10]);
  const pins = (await one(U.teacherA, `select public.live_results($1) r`, [pin])).r.pins;
  assert.equal(pins.length, 3, 'ثلاث إشارات لكل طالب');
  await rows(U.teacherA, `update public.live_sessions set status = 'ended' where id = $1`, [s.id]);
  assert.equal((await rows(S.s1.uid, `select id from public.live_sessions where id = $1`, [s.id])).length, 0, 'الجلسة المنتهية تختفي عن الطلاب');
});

test('الفسيفساء الكبرى: جزء لكل صف، يحرّكه طلابه فقط، وتكتمل اللوحة بأسماء المدارس', async () => {
  await rows(U.admin, `insert into public.grand_mosaics (slug, title_ar, summary_ar, image_path, credit, license, source_url, width, height, cols, rows, piece_grid, is_demo)
    values ('t', 'تجربة', 'ملخص', '/media/x.jpg', 'c', 'CC0', 'https://example.org', 100, 50, 2, 1, 2, true)`);
  await fails(U.teacherA, `insert into public.grand_mosaics (slug, title_ar, summary_ar, image_path, credit, license, source_url, width, height, cols, rows)
    values ('u', 'x', 'x', '/x', 'c', 'l', 's', 1, 1, 1, 1)`, [], /row-level security/);
  const secA = (await one(U.teacherA, `select public.grand_claim('t', $1) s`, [classA])).s;
  assert.equal((await one(U.teacherA, `select public.grand_claim('t', $1) s`, [classA])).s, secA, 'المطالبة مرة واحدة');
  await fails(S.s1.uid, `select public.grand_claim('t', $1)`, [classA], /not allowed/);
  await fails(U.teacherB, `select public.grand_claim('t', $1)`, [classA], /not allowed/);
  const secB = (await one(U.teacherB, `select public.grand_claim('t', $1) s`, [classB])).s;
  assert.notEqual(secA, secB);
  await fails(U.teacherC, `select public.grand_claim('t', $1)`, [S.classC], /no free sections/);
  await fails(S.s3.uid, `select public.grand_move($1, 0, 1)`, [secA], /not allowed/);
  await fails(U.outsider, `select public.grand_move($1, 0, 1)`, [secA], /not allowed/);
  await fails(S.s1.uid, `update public.grand_sections set completed_at = now() where id = $1`, [secA], /permission denied/);
  // حل الجزء بتبديلات صحيحة من طالبين بالتناوب
  const solve = async (sec, users) => {
    let k = 0;
    for (;;) {
      const st = (await db.query(`select state from public.grand_sections where id = $1`, [sec])).rows[0].state;
      const i = st.findIndex((v, j) => v !== j); if (i < 0) return;
      const j = st.indexOf(i);
      const r = (await one(users[k++ % users.length], `select public.grand_move($1, $2, $3) r`, [sec, i, j])).r;
      if (r.done) return;
    }
  };
  await solve(secA, [S.s1.uid, S.s2.uid]);
  let board = (await one(null, `select public.grand_board('t') b`)).b;
  assert.equal(board.sections.find((x) => x.id === secA).school, 'مدرسة إربد');
  assert.equal(board.mosaic.completed_at, null);
  await solve(secB, [S.s3.uid, S.s4.uid]);
  board = (await one(null, `select public.grand_board('t') b`)).b;
  assert.ok(board.mosaic.completed_at, 'اكتملت اللوحة');
  assert.equal(board.sections.find((x) => x.id === secB).school, 'مدرسة في العقبة');
  // الزائر لا يرى أي صف تبنّى أي جزء
  assert.equal((await rows(null, `select * from public.grand_claims`)).length, 0);
  assert.equal((await rows(U.outsider, `select * from public.grand_claims`)).length, 0);
  assert.equal((await rows(S.s1.uid, `select * from public.grand_claims`)).length, 1);
  // حذف التجريبي يزيل اللوحة وأجزاءها
  await rows(U.admin, `select public.admin_purge_demo()`);
  assert.equal((await db.query(`select count(*)::int n from public.grand_mosaics where slug = 't'`)).rows[0].n, 0);
  assert.equal((await db.query(`select count(*)::int n from public.grand_sections s join public.grand_mosaics m on m.id = s.mosaic_id where m.slug = 'madaba-map'`)).rows[0].n, 24, 'اللوحة الحقيقية تبقى');
});

test('مختبر الترميم: أفضل الأزمنة بلا بيانات شخصية، ولا أزمنة مستحيلة', async () => {
  await db.query(`insert into public.mosaics (slug, title_ar, summary_ar, image_path, credit, license, source_url, grid, published) values ('lb', 'x', 'x', '/x.jpg', 'c', 'l', 's', 4, true)`);
  assert.equal((await one(null, `select public.finish_mosaic('lb', 3, 1) r`)).r, null, 'زمن مستحيل يُرفض');
  assert.equal((await one(null, `select public.finish_mosaic('lb', 20, 60) r`)).r, 1);
  assert.equal((await one(U.outsider, `select public.finish_mosaic('lb', 20, 40) r`)).r, 1);
  const lb = await rows(null, `select * from public.mosaic_leaderboard('lb')`);
  assert.deepEqual(lb.map((x) => x.seconds), [40, 60]);
  assert.deepEqual(Object.keys(lb[0]).sort(), ['created_at', 'moves', 'seconds']);
});

test('حذف صف يعيد جزءه من الفسيفساء حراً', async () => {
  const c = (await one(U.teacherC, `insert into public.classes (school_id, teacher_id, name) values ((select school_id from public.classes where id = $1), $2, 'مؤقت') returning id`, [S.classC, U.teacherC])).id;
  const sec = (await one(U.teacherC, `select public.grand_claim('madaba-map', $1) s`, [c])).s;
  assert.equal((await db.query(`select claimed from public.grand_sections where id = $1`, [sec])).rows[0].claimed, true);
  await rows(U.teacherC, `delete from public.classes where id = $1`, [c]);
  const r = (await db.query(`select claimed, state from public.grand_sections where id = $1`, [sec])).rows[0];
  assert.equal(r.claimed, false); assert.deepEqual(r.state, []);
});

test('حذف الطالب يحذف حسابه وكل ما كتبه', async () => {
  const [x] = await rows(U.teacherA, `select * from public.teacher_add_students($1, array['مؤقت'])`, [classA]);
  const uid = (await db.query(`select student_id from public.class_members where id = $1`, [x.member_id])).rows[0].student_id;
  await fails(U.teacherB, `select public.teacher_remove_student($1)`, [x.member_id], /not allowed/);
  await rows(U.teacherA, `select public.teacher_remove_student($1)`, [x.member_id]);
  assert.equal((await db.query(`select count(*)::int n from auth.users where id = $1`, [uid])).rows[0].n, 0);
});
