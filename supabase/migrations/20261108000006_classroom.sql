-- الصف التشاركي: حسابات الطلاب بلا بريد، وتوأمة المدارس، والجلسة المباشرة، والفسيفساء الكبرى.
-- القواعد: الطالب باسم مستعار فقط. لا يرى أحد خارج صفه شيئاً كتبه قبل أن يراجعه معلمه.
-- لا تواصل مباشر بين طلاب مدرستين إلا عبر محتوى مراجَع، ولا رسائل خاصة إطلاقاً.

create extension if not exists pgcrypto with schema extensions;

-- ═════════════════════ المدارس: موقعها (محافظتها) ═════════════════════
-- place_id موجود؛ نضيف فهرساً ودالة اسم عام للمدرسة لا يكشف اسمها إن لم توافق على الظهور
create or replace function public.school_label(s uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when sc.public_listing then sc.name else 'مدرسة في ' || coalesce(p.name_ar, 'الأردن') end
  from public.schools sc left join public.places p on p.id = sc.place_id where sc.id = s
$$;

-- ═════════════════════ حسابات الطلاب ═════════════════════
alter table public.class_members add column id uuid not null default gen_random_uuid();
alter table public.class_members add constraint class_members_id_key unique (id);
alter table public.class_members add column login text;
alter table public.class_members add constraint class_members_login_key unique (login);
comment on column public.class_members.login is 'الجزء العلني من رمز دخول الطالب. الجزء السري لا يُخزَّن إلا مُجزّأً في auth.users.';

-- عضوية المستخدم الحالي (لدوال الصلاحيات)
create or replace function public.my_member_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.class_members where student_id = auth.uid()
$$;
create or replace function public.member_class(m uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select class_id from public.class_members where id = m
$$;

-- حروف بلا التباس (لا O/0 ولا I/1)
create or replace function public.rand_code(n int)
returns text language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; r text := ''; i int;
begin
  for i in 1..n loop r := r || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
  return r;
end $$;
revoke execute on function public.rand_code(int) from public, anon, authenticated;

create or replace function public.student_email(handle text)
returns text language sql immutable set search_path = '' as $$
  select 's-' || lower(handle) || '@students.thakirat-watan.example'
$$;

/** المعلم يضيف طلاباً بأسماء مستعارة. يعيد رمز الدخول لكل طالب مرة واحدة (لا يُخزَّن سرّه إلا مُجزّأً). */
create or replace function public.teacher_add_students(p_class uuid, p_pseudonyms text[])
returns table (member_id uuid, pseudonym text, code text) language plpgsql security definer set search_path = '' as $$
declare c public.classes; nm text; uid uuid; handle text; secret text; mid uuid; n int;
begin
  select * into c from public.classes where id = p_class;
  if c.id is null or c.teacher_id is distinct from auth.uid() then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(array_length(p_pseudonyms, 1), 0) = 0 or array_length(p_pseudonyms, 1) > 60 then
    raise exception 'between 1 and 60 students' using errcode = '22023'; end if;
  select count(*) into n from public.class_members where class_id = p_class;
  if n + array_length(p_pseudonyms, 1) > 60 then raise exception 'class is full' using errcode = '22023'; end if;
  foreach nm in array p_pseudonyms loop
    nm := btrim(nm);
    if char_length(nm) not between 2 and 40 then raise exception 'pseudonym must be 2-40 chars' using errcode = '22023'; end if;
    if nm ~ '[@<>]|https?:' then raise exception 'pseudonym not allowed' using errcode = '22023'; end if;
    loop
      handle := public.rand_code(5);
      exit when not exists (select 1 from public.class_members where login = handle);
    end loop;
    secret := public.rand_code(6);
    uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', public.student_email(handle),
      extensions.crypt(handle || '-' || secret, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"],"student":true}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', public.student_email(handle), 'email_verified', true), 'email', now(), now());
    -- الطالب ليس مساهماً عاماً: لا يضيف مواد إلى الأرشيف
    delete from public.user_roles where user_id = uid and role = 'contributor';
    insert into public.user_roles (user_id, role, school_id, granted_by) values (uid, 'student', c.school_id, auth.uid());
    update public.profiles set is_minor = true, display_name = null where id = uid;
    insert into public.class_members (class_id, student_id, pseudonym, login) values (p_class, uid, nm, handle) returning id into mid;
    member_id := mid; pseudonym := nm; code := handle || '-' || secret;
    return next;
  end loop;
  perform public.audit('students_added', 'classes', p_class::text, jsonb_build_object('count', array_length(p_pseudonyms, 1)));
end $$;
revoke execute on function public.teacher_add_students(uuid, text[]) from public, anon;
grant execute on function public.teacher_add_students(uuid, text[]) to authenticated;

create or replace function public.teacher_reset_code(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.class_members; secret text;
begin
  select * into m from public.class_members where id = p_member;
  if m.id is null or not public.is_class_teacher(m.class_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  secret := public.rand_code(6);
  update auth.users set encrypted_password = extensions.crypt(m.login || '-' || secret, extensions.gen_salt('bf')), updated_at = now() where id = m.student_id;
  perform public.audit('student_code_reset', 'class_members', p_member::text, '{}'::jsonb);
  return m.login || '-' || secret;
end $$;
revoke execute on function public.teacher_reset_code(uuid) from public, anon;
grant execute on function public.teacher_reset_code(uuid) to authenticated;

create or replace function public.teacher_remove_student(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.class_members;
begin
  select * into m from public.class_members where id = p_member;
  if m.id is null or not public.is_class_teacher(m.class_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  -- حساب الطالب أنشأه المعلم؛ حذفه يحذف كل ما كتبه (لا بقايا لقاصر)
  if m.login is not null then delete from auth.users where id = m.student_id; else delete from public.class_members where id = p_member; end if;
  perform public.audit('student_removed', 'class_members', p_member::text, '{}'::jsonb);
end $$;
revoke execute on function public.teacher_remove_student(uuid) from public, anon;
grant execute on function public.teacher_remove_student(uuid) to authenticated;

-- زملاء الصف بأسمائهم المستعارة فقط (للعب المشترك داخل الصف)
create or replace function public.my_classmates(p_class uuid)
returns table (member_id uuid, pseudonym text) language sql stable security definer set search_path = '' as $$
  select cm.id, cm.pseudonym from public.class_members cm
  where cm.class_id = p_class and (public.is_class_member(p_class) or public.is_class_teacher(p_class))
  order by cm.pseudonym
$$;

-- صف الطالب الحالي (لصفحته الرئيسية)
create or replace function public.my_class()
returns table (class_id uuid, member_id uuid, pseudonym text, class_name text, grade smallint, school text, governorate text)
language sql stable security definer set search_path = '' as $$
  select c.id, cm.id, cm.pseudonym, c.name, c.grade, sc.name, p.name_ar
  from public.class_members cm join public.classes c on c.id = cm.class_id join public.schools sc on sc.id = c.school_id
  left join public.places p on p.id = sc.place_id
  where cm.student_id = auth.uid() order by cm.joined_at limit 1
$$;

-- صف في مدرسة تجريبية تجريبي هو أيضاً، فيُحذف مع admin_purge_demo()
create or replace function public.tg_class_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.is_demo := new.is_demo or coalesce((select is_demo from public.schools where id = new.school_id), false);
  return new;
end $$;
revoke execute on function public.tg_class_demo() from public, anon, authenticated;
create trigger class_demo before insert on public.classes for each row execute function public.tg_class_demo();

-- ═════════════════════ أ. توأمة المدارس ═════════════════════
alter table public.classes add column open_for_twinning boolean not null default false;

create table public.twinnings (
  id uuid primary key default gen_random_uuid(),
  class_a uuid not null references public.classes(id) on delete cascade,
  class_b uuid not null references public.classes(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed','active','ended')),
  proposed_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (class_a <> class_b)
);
create unique index twinnings_pair on public.twinnings (least(class_a, class_b), greatest(class_a, class_b)) where status <> 'ended';
create index on public.twinnings (class_a); create index on public.twinnings (class_b);
alter table public.twinnings enable row level security;

create or replace function public.in_twinning(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.twinnings w where w.id = t and (
    public.is_class_teacher(w.class_a) or public.is_class_teacher(w.class_b)
    or public.is_class_member(w.class_a) or public.is_class_member(w.class_b)))
$$;
create policy twin_select on public.twinnings for select using (public.in_twinning(id) or public.is_admin());
revoke insert, update, delete on public.twinnings from anon, authenticated;

-- الصفوف المفتوحة للتوأمة (للمعلمين فقط): المدرسة والمحافظة والصف، بلا أي بيانات عن الطلاب
create or replace function public.twin_directory()
returns table (class_id uuid, class_name text, grade smallint, school text, governorate text, gov_key text, lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.grade, public.school_label(sc.id), p.name_ar, p.key, p.lat, p.lng
  from public.classes c join public.schools sc on sc.id = c.school_id left join public.places p on p.id = sc.place_id
  where c.open_for_twinning and public.has_role('teacher') and c.teacher_id <> auth.uid()
  order by p.name_ar, c.grade
$$;

create or replace function public.twin_propose(p_mine uuid, p_theirs uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.classes; b public.classes; ga uuid; gb uuid; t uuid;
begin
  select * into a from public.classes where id = p_mine;
  select * into b from public.classes where id = p_theirs;
  if a.id is null or a.teacher_id is distinct from auth.uid() then raise exception 'not allowed' using errcode = '42501'; end if;
  if b.id is null or not b.open_for_twinning then raise exception 'class not open for twinning' using errcode = '22023'; end if;
  select place_id into ga from public.schools where id = a.school_id;
  select place_id into gb from public.schools where id = b.school_id;
  if ga is null or gb is null or ga = gb then raise exception 'twin must be in another governorate' using errcode = '22023'; end if;
  if not public.check_rate_limit('twin:' || auth.uid()::text, 20, 86400) then raise exception 'too many attempts' using errcode = '54000'; end if;
  insert into public.twinnings (class_a, class_b) values (p_mine, p_theirs) returning id into t;
  perform public.audit('twin_proposed', 'twinnings', t::text, jsonb_build_object('a', p_mine, 'b', p_theirs));
  return t;
end $$;

create or replace function public.twin_respond(p_twin uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare w public.twinnings;
begin
  select * into w from public.twinnings where id = p_twin;
  if w.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_accept then
    if w.status <> 'proposed' or not public.is_class_teacher(w.class_b) then raise exception 'not allowed' using errcode = '42501'; end if;
    update public.twinnings set status = 'active', accepted_at = now() where id = p_twin;
  else
    if not (public.is_class_teacher(w.class_a) or public.is_class_teacher(w.class_b) or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
    update public.twinnings set status = 'ended' where id = p_twin;
  end if;
  perform public.audit('twin_' || case when p_accept then 'accepted' else 'ended' end, 'twinnings', p_twin::text, '{}'::jsonb);
  return case when p_accept then 'active' else 'ended' end;
end $$;

create table public.twin_messages (
  id uuid primary key default gen_random_uuid(),
  twinning_id uuid not null references public.twinnings(id) on delete cascade,
  from_class uuid not null references public.classes(id) on delete cascade,
  author_member uuid references public.class_members(id) on delete cascade,
  author_teacher uuid references auth.users(id) on delete set null,
  parent_id uuid references public.twin_messages(id) on delete cascade,
  kind text not null check (kind in ('question','answer')),
  body text not null check (char_length(btrim(body)) between 2 and 1200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((author_member is null) <> (author_teacher is null)),
  check (kind = 'question' or parent_id is not null)
);
create index on public.twin_messages (twinning_id, status);
create index on public.twin_messages (from_class, status);
alter table public.twin_messages enable row level security;
-- يرى: معلم الصف المرسل كل رسائل صفه؛ والطالب رسائله هو؛ وكل أطراف التوأمة الرسائل المعتمدة فقط
create policy twinmsg_select on public.twin_messages for select using (
  public.is_class_teacher(from_class)
  or author_member in (select public.my_member_ids())
  or (status = 'approved' and public.in_twinning(twinning_id))
  or public.is_admin());
revoke insert, update, delete on public.twin_messages from anon, authenticated;

create table public.twin_media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.twin_messages(id) on delete cascade,
  kind text not null check (kind in ('image','audio')),
  path text not null unique,
  mime text not null check (mime in ('image/jpeg','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg')),
  bytes int not null check (bytes between 1 and 8000000),
  width int, height int, seconds real check (seconds is null or seconds between 0 and 180),
  alt text check (char_length(alt) <= 200),
  created_at timestamptz not null default now()
);
create index on public.twin_media (message_id);
alter table public.twin_media enable row level security;
create or replace function public.can_read_twin_message(m uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.twin_messages x where x.id = m and (
    public.is_class_teacher(x.from_class) or x.author_member in (select public.my_member_ids())
    or (x.status = 'approved' and public.in_twinning(x.twinning_id)) or public.is_admin()))
$$;
create policy twinmedia_select on public.twin_media for select using (public.can_read_twin_message(message_id));
revoke insert, update, delete on public.twin_media from anon, authenticated;

-- التوأمات التي يشارك فيها المستخدم، مع موقع المدرستين للخريطة
create or replace function public.my_twinnings()
returns table (id uuid, status text, mine uuid, theirs uuid, my_school text, their_school text, my_gov text, their_gov text,
  my_lat double precision, my_lng double precision, their_lat double precision, their_lng double precision, i_am_teacher boolean, can_accept boolean, approved int)
language sql stable security definer set search_path = '' as $$
  with w as (
    select t.*, case when public.is_class_teacher(t.class_a) or public.is_class_member(t.class_a) then t.class_a else t.class_b end as mine
    from public.twinnings t where t.status <> 'ended' and public.in_twinning(t.id)
  )
  select w.id, w.status, w.mine, case when w.mine = w.class_a then w.class_b else w.class_a end,
    public.school_label(sa.id), public.school_label(sb.id), pa.name_ar, pb.name_ar, pa.lat, pa.lng, pb.lat, pb.lng,
    public.is_class_teacher(w.mine), (w.status = 'proposed' and public.is_class_teacher(w.class_b) and w.mine = w.class_b),
    (select count(*)::int from public.twin_messages m where m.twinning_id = w.id and m.status = 'approved')
  from w
  join public.classes ca on ca.id = w.mine join public.schools sa on sa.id = ca.school_id left join public.places pa on pa.id = sa.place_id
  join public.classes cb on cb.id = case when w.mine = w.class_a then w.class_b else w.class_a end
  join public.schools sb on sb.id = cb.school_id left join public.places pb on pb.id = sb.place_id
$$;


/** كتابة رسالة: الطالب تبدأ رسالته بانتظار معلمه؛ المعلم تُعتمد رسالته مباشرة */
create or replace function public.twin_post(p_twin uuid, p_kind text, p_body text, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w public.twinnings; mine uuid; mem uuid; v_id uuid; par public.twin_messages;
begin
  select * into w from public.twinnings where twinnings.id = p_twin;
  if w.id is null or w.status <> 'active' then raise exception 'twinning not active' using errcode = '22023'; end if;
  select cm.id, cm.class_id into mem, mine from public.class_members cm
    where cm.student_id = auth.uid() and cm.class_id in (w.class_a, w.class_b) limit 1;
  if mem is null then
    if public.is_class_teacher(w.class_a) then mine := w.class_a;
    elsif public.is_class_teacher(w.class_b) then mine := w.class_b;
    else raise exception 'not allowed' using errcode = '42501'; end if;
  end if;
  if p_kind not in ('question','answer') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_kind = 'answer' then
    select * into par from public.twin_messages where twin_messages.id = p_parent;
    -- الجواب يكون على سؤال معتمد من الصف التوأم فقط
    if par.id is null or par.twinning_id <> p_twin or par.kind <> 'question' or par.status <> 'approved' or par.from_class = mine then
      raise exception 'answer must reply to an approved question from the twin class' using errcode = '22023'; end if;
  end if;
  if not public.check_rate_limit('twinpost:' || auth.uid()::text, 40, 86400) then raise exception 'too many attempts' using errcode = '54000'; end if;
  insert into public.twin_messages (twinning_id, from_class, author_member, author_teacher, parent_id, kind, body, status, reviewed_by, reviewed_at)
  values (p_twin, mine, mem, case when mem is null then auth.uid() end, case when p_kind = 'answer' then p_parent end, p_kind, btrim(p_body),
          case when mem is null then 'approved' else 'pending' end, case when mem is null then auth.uid() end, case when mem is null then now() end)
  returning twin_messages.id into v_id;
  return v_id;
end $$;

create or replace function public.twin_review(p_msg uuid, p_approve boolean, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.twin_messages;
begin
  select * into m from public.twin_messages where id = p_msg;
  if m.id is null or not public.is_class_teacher(m.from_class) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then raise exception 'rejection requires a reason' using errcode = '22023'; end if;
  update public.twin_messages set status = case when p_approve then 'approved' else 'rejected' end,
    reject_reason = case when p_approve then null else p_reason end, reviewed_by = auth.uid(), reviewed_at = now() where id = p_msg;
  perform public.audit('twin_review', 'twin_messages', p_msg::text, jsonb_build_object('approve', p_approve));
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- الوسائط: يرفعها الخادم بجلسة الطالب، ويُسجَّل الملف هنا فقط لصاحب رسالة بانتظار المراجعة
create or replace function public.twin_attach(p_msg uuid, p_kind text, p_path text, p_mime text, p_bytes int, p_w int, p_h int, p_seconds real, p_alt text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.twin_messages; v_id uuid;
begin
  select * into m from public.twin_messages where twin_messages.id = p_msg;
  if m.id is null or not coalesce((m.status = 'pending' and m.author_member in (select public.my_member_ids())) or m.author_teacher = auth.uid(), false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('image','audio') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_path !~ ('^' || m.twinning_id::text || '/' || m.id::text || '/[0-9a-f-]{36}\.(jpg|webp|webm|ogg|m4a|mp3)$') then raise exception 'bad path' using errcode = '22023'; end if;
  if (select count(*) from public.twin_media where message_id = p_msg) >= 4 then raise exception 'too many files' using errcode = '22023'; end if;
  insert into public.twin_media (message_id, kind, path, mime, bytes, width, height, seconds, alt)
  values (p_msg, p_kind, p_path, p_mime, p_bytes, p_w, p_h, p_seconds, p_alt) returning twin_media.id into v_id;
  return v_id;
end $$;

-- ═════════════════════ د. الجلسة المباشرة ═════════════════════
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  code text not null,
  title text not null default 'جلسة' check (char_length(title) between 1 and 120),
  status text not null default 'open' check (status in ('open','ended')),
  current int not null default 0,
  reveal boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index live_code_open on public.live_sessions (code) where status = 'open';
create index on public.live_sessions (class_id);
alter table public.live_sessions enable row level security;
create policy live_select on public.live_sessions for select using (
  teacher_id = auth.uid() or (status = 'open' and public.is_class_member(class_id)) or public.is_admin());
create policy live_update on public.live_sessions for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy live_delete on public.live_sessions for delete using (teacher_id = auth.uid());
revoke insert on public.live_sessions from anon, authenticated;
revoke update on public.live_sessions from anon, authenticated;
grant update (current, reveal, status, ended_at, title) on public.live_sessions to authenticated;

create table public.live_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  idx int not null check (idx between 0 and 49),
  kind text not null check (kind in ('poll','text','pin')),
  prompt text not null check (char_length(btrim(prompt)) between 2 and 300),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 6),
  item_id uuid references public.items(id) on delete set null,
  image text check (image is null or image ~ '^/media/[a-z0-9/_-]+\.jpg$'),
  unique (session_id, idx)
);
alter table public.live_activities enable row level security;
create or replace function public.can_see_live(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.live_sessions l where l.id = s and (l.teacher_id = auth.uid() or (l.status = 'open' and public.is_class_member(l.class_id))))
$$;
create or replace function public.owns_live(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.live_sessions l where l.id = s and l.teacher_id = auth.uid())
$$;
create policy act_select on public.live_activities for select using (public.can_see_live(session_id));
create policy act_write on public.live_activities for all using (public.owns_live(session_id)) with check (public.owns_live(session_id));

create table public.live_responses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.live_activities(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  member_id uuid not null references public.class_members(id) on delete cascade,
  choice int check (choice between 0 and 5),
  body text check (char_length(body) <= 280),
  x real check (x between 0 and 1), y real check (y between 0 and 1),
  shown boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.live_responses (activity_id);
create index on public.live_responses (session_id);
alter table public.live_responses enable row level security;
-- المعلم يرى كل الإجابات؛ الطالب إجاباته فقط. شاشة الصف تعرض النصوص بعد موافقة المعلم (shown)
create policy resp_select on public.live_responses for select using (
  public.owns_live(session_id) or member_id in (select public.my_member_ids()));
revoke insert, update, delete on public.live_responses from anon, authenticated;
grant update (shown) on public.live_responses to authenticated;
create policy resp_update on public.live_responses for update using (public.owns_live(session_id)) with check (public.owns_live(session_id));

create or replace function public.live_open(p_class uuid, p_title text)
returns table (id uuid, code text) language plpgsql security definer set search_path = '' as $$
declare c text; sid uuid;
begin
  if not public.is_class_teacher(p_class) then raise exception 'not allowed' using errcode = '42501'; end if;
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.live_sessions l where l.code = c and l.status = 'open');
  end loop;
  insert into public.live_sessions (class_id, code, title) values (p_class, c, coalesce(nullif(btrim(p_title), ''), 'جلسة')) returning live_sessions.id into sid;
  id := sid; code := c; return next;
end $$;

-- الطالب يدخل برمز الجلسة: يُقبل فقط إن كان من صفها
create or replace function public.live_join(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare l public.live_sessions;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not public.check_rate_limit('livejoin:' || auth.uid()::text, 30, 3600) then raise exception 'too many attempts' using errcode = '54000'; end if;
  select * into l from public.live_sessions where code = btrim(p_code) and status = 'open';
  if l.id is null or not public.is_class_member(l.class_id) then return null; end if;
  return l.id;
end $$;

create or replace function public.live_respond(p_activity uuid, p_choice int default null, p_body text default null, p_x real default null, p_y real default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.live_activities; l public.live_sessions; mem uuid; rid uuid; n int;
begin
  select * into a from public.live_activities where id = p_activity;
  select * into l from public.live_sessions where id = a.session_id;
  if l.id is null or l.status <> 'open' or l.current <> a.idx then raise exception 'activity not open' using errcode = '22023'; end if;
  select id into mem from public.class_members where student_id = auth.uid() and class_id = l.class_id;
  if mem is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not public.check_rate_limit('liveresp:' || auth.uid()::text, 200, 3600) then raise exception 'too many attempts' using errcode = '54000'; end if;
  if a.kind = 'poll' then
    if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(a.options) then raise exception 'bad choice' using errcode = '22023'; end if;
    delete from public.live_responses where activity_id = a.id and member_id = mem;
    insert into public.live_responses (activity_id, session_id, member_id, choice) values (a.id, l.id, mem, p_choice) returning id into rid;
  elsif a.kind = 'text' then
    if char_length(btrim(coalesce(p_body, ''))) not between 1 and 280 then raise exception 'bad text' using errcode = '22023'; end if;
    delete from public.live_responses where activity_id = a.id and member_id = mem;
    insert into public.live_responses (activity_id, session_id, member_id, body) values (a.id, l.id, mem, btrim(p_body)) returning id into rid;
  else
    if p_x is null or p_y is null then raise exception 'bad pin' using errcode = '22023'; end if;
    select count(*) into n from public.live_responses where activity_id = a.id and member_id = mem;
    if n >= 3 then delete from public.live_responses where id = (select id from public.live_responses where activity_id = a.id and member_id = mem order by created_at limit 1); end if;
    insert into public.live_responses (activity_id, session_id, member_id, x, y) values (a.id, l.id, mem, least(1, greatest(0, p_x)), least(1, greatest(0, p_y))) returning id into rid;
  end if;
  return rid;
end $$;

-- النتائج للصف: أعداد التصويت والإشارات بلا أسماء، والنصوص التي أظهرها المعلم فقط باسم مستعار
create or replace function public.live_results(p_activity uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not public.can_see_live(a.session_id) then null else jsonb_build_object(
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('choice', choice, 'n', n)), '[]'::jsonb) from (select choice, count(*)::int n from public.live_responses where activity_id = a.id and choice is not null group by choice) v),
    'pins', (select coalesce(jsonb_agg(jsonb_build_array(round(x::numeric, 3), round(y::numeric, 3))), '[]'::jsonb) from public.live_responses where activity_id = a.id and x is not null),
    'texts', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'by', cm.pseudonym) order by r.created_at), '[]'::jsonb)
              from public.live_responses r join public.class_members cm on cm.id = r.member_id where r.activity_id = a.id and r.body is not null and r.shown),
    'answered', (select count(distinct member_id)::int from public.live_responses where activity_id = a.id),
    'class_size', (select count(*)::int from public.class_members cm join public.live_sessions l on l.class_id = cm.class_id where l.id = a.session_id)
  ) end
  from public.live_activities a where a.id = p_activity
$$;

-- ═════════════════════ ج. الفسيفساء الكبرى ═════════════════════
create table public.grand_mosaics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title_ar text not null,
  summary_ar text not null,
  image_path text not null,
  credit text not null, license text not null, license_url text, source_url text not null,
  width int not null, height int not null,
  cols int not null check (cols between 1 and 12), rows int not null check (rows between 1 and 12),
  piece_grid int not null default 4 check (piece_grid between 2 and 6),
  is_demo boolean not null default false,
  published boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.grand_mosaics enable row level security;
create policy grand_select on public.grand_mosaics for select using (published or public.is_staff());
create policy grand_write on public.grand_mosaics for all using (public.is_admin()) with check (public.is_admin());

-- الأجزاء: لا شيء شخصي هنا (الصف المتبنّي في جدول منفصل)
create table public.grand_sections (
  id uuid primary key default gen_random_uuid(),
  mosaic_id uuid not null references public.grand_mosaics(id) on delete cascade,
  idx int not null,
  state int[] not null default '{}',
  moves int not null default 0,
  claimed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (mosaic_id, idx)
);
alter table public.grand_sections enable row level security;
create policy gsec_select on public.grand_sections for select using (true);
revoke insert, update, delete on public.grand_sections from anon, authenticated;

create table public.grand_claims (
  section_id uuid primary key references public.grand_sections(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
create unique index grand_one_section_per_class on public.grand_claims (class_id);
alter table public.grand_claims enable row level security;
create policy gclaim_select on public.grand_claims for select using (
  public.is_class_teacher(class_id) or public.is_class_member(class_id) or public.is_admin());
revoke insert, update, delete on public.grand_claims from anon, authenticated;

-- حين يُحذف صف (أو تُلغى مطالبته) يعود جزؤه حراً لصف آخر
create or replace function public.grand_release()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.grand_sections set claimed = false, state = '{}', moves = 0, completed_at = null, updated_at = now()
  where id = old.section_id and completed_at is null;
  return old;
end $$;
revoke execute on function public.grand_release() from public, anon, authenticated;
create trigger grand_release after delete on public.grand_claims for each row execute function public.grand_release();

create or replace function public.grand_seed_sections()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.grand_sections (mosaic_id, idx) select new.id, g from generate_series(0, new.cols * new.rows - 1) g;
  return new;
end $$;
create trigger grand_seed after insert on public.grand_mosaics for each row execute function public.grand_seed_sections();
revoke execute on function public.grand_seed_sections() from public, anon, authenticated;

create or replace function public.shuffled(n int)
returns int[] language plpgsql volatile set search_path = '' as $$
declare a int[]; i int; j int; t int;
begin
  a := array(select g from generate_series(0, n - 1) g);
  for i in reverse n..2 loop j := 1 + floor(random() * i)::int; t := a[i]; a[i] := a[j]; a[j] := t; end loop;
  if a = array(select g from generate_series(0, n - 1) g) then t := a[1]; a[1] := a[2]; a[2] := t; end if;
  return a;
end $$;

/** المعلم يتبنى لصفه جزءاً حراً من اللوحة (جزء واحد لكل صف) */
create or replace function public.grand_claim(p_slug text, p_class uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.grand_mosaics; s uuid;
begin
  if not public.is_class_teacher(p_class) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into m from public.grand_mosaics where slug = p_slug and published;
  if m.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  select gc.section_id into s from public.grand_claims gc join public.grand_sections g on g.id = gc.section_id where gc.class_id = p_class and g.mosaic_id = m.id;
  if s is not null then return s; end if;
  if exists (select 1 from public.grand_claims where class_id = p_class) then raise exception 'class already has a section' using errcode = '22023'; end if;
  select id into s from public.grand_sections where mosaic_id = m.id and not claimed order by random() limit 1 for update skip locked;
  if s is null then raise exception 'no free sections' using errcode = '22023'; end if;
  update public.grand_sections set claimed = true, state = public.shuffled(m.piece_grid * m.piece_grid), updated_at = now() where id = s;
  insert into public.grand_claims (section_id, class_id) values (s, p_class);
  perform public.audit('grand_claim', 'grand_sections', s::text, jsonb_build_object('class', p_class));
  return s;
end $$;

/** تبديل قطعتين في جزء الصف. القفل على الصف يمنع تضارب الطلاب المتزامنين. */
create or replace function public.grand_move(p_section uuid, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.grand_sections; c uuid; st int[]; t int; n int; done boolean; mid uuid;
begin
  select class_id into c from public.grand_claims where section_id = p_section;
  if c is null or not (public.is_class_member(c) or public.is_class_teacher(c)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not public.check_rate_limit('grandmove:' || auth.uid()::text, 600, 600) then raise exception 'too many attempts' using errcode = '54000'; end if;
  select * into g from public.grand_sections where id = p_section for update;
  if g.completed_at is not null then return jsonb_build_object('state', g.state, 'done', true); end if;
  n := array_length(g.state, 1);
  if p_from < 0 or p_to < 0 or p_from >= n or p_to >= n or p_from = p_to then raise exception 'bad move' using errcode = '22023'; end if;
  st := g.state; t := st[p_from + 1]; st[p_from + 1] := st[p_to + 1]; st[p_to + 1] := t;
  done := st = array(select x from generate_series(0, n - 1) x);
  update public.grand_sections set state = st, moves = moves + 1, updated_at = now(), completed_at = case when done then now() end where id = p_section;
  if done then
    select mosaic_id into mid from public.grand_sections where id = p_section;
    if not exists (select 1 from public.grand_sections where mosaic_id = mid and completed_at is null) then
      update public.grand_mosaics set completed_at = now() where id = mid and completed_at is null;
    end if;
  end if;
  return jsonb_build_object('state', st, 'done', done);
end $$;

-- اللوحة للعامة: الأجزاء ومن رمّمها (اسم المدرسة إن وافقت، وإلا محافظتها فقط)
create or replace function public.grand_board(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mosaic', to_jsonb(m) - 'is_demo' || jsonb_build_object('is_demo', m.is_demo),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'idx', s.idx, 'claimed', s.claimed, 'done', s.completed_at is not null, 'completed_at', s.completed_at, 'moves', s.moves,
        'state', case when s.completed_at is null then s.state end,
        'school', case when s.completed_at is not null then (select public.school_label(cl.school_id) from public.grand_claims gc join public.classes cl on cl.id = gc.class_id where gc.section_id = s.id) end,
        'mine', exists (select 1 from public.grand_claims gc where gc.section_id = s.id and (public.is_class_member(gc.class_id) or public.is_class_teacher(gc.class_id)))
      ) order by s.idx), '[]'::jsonb) from public.grand_sections s where s.mosaic_id = m.id))
  from public.grand_mosaics m where m.slug = p_slug and (m.published or public.is_staff())
$$;

-- ═════════════════════ الصلاحيات على الدوال ═════════════════════
do $$ declare f text; begin
  foreach f in array array[
    'twin_propose(uuid,uuid)','twin_respond(uuid,boolean)','twin_post(uuid,text,text,uuid)','twin_review(uuid,boolean,text)',
    'twin_attach(uuid,text,text,text,integer,integer,integer,real,text)','live_open(uuid,text)','live_join(text)',
    'live_respond(uuid,integer,text,real,real)','grand_claim(text,uuid)','grand_move(uuid,integer,integer)','my_twinnings()','twin_directory()',
    'my_classmates(uuid)','my_class()','live_results(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.shuffled(int) from public, anon, authenticated;
grant execute on function public.grand_board(text) to anon, authenticated;

-- التدقيق على الجداول الحساسة
create trigger audit_twinnings after update or delete on public.twinnings for each row execute function public.tg_audit();
create trigger audit_grand after insert or update or delete on public.grand_mosaics for each row execute function public.tg_audit();

-- ═════════════════════ التحديث اللحظي وتخزين الوسائط (في Supabase فقط) ═════════════════════
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_sessions, public.live_responses, public.live_activities, public.grand_sections, public.twin_messages;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('twin', 'twin', false, 8000000, array['image/jpeg','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
    on conflict (id) do nothing;
    -- الرفع: صاحب رسالة بانتظار المراجعة فقط، وفي مجلد رسالته
    execute $p$create policy twin_upload on storage.objects for insert to authenticated with check (
      bucket_id = 'twin' and exists (select 1 from public.twin_messages m where m.id::text = (storage.foldername(name))[2]
        and m.twinning_id::text = (storage.foldername(name))[1]
        and coalesce((m.status = 'pending' and m.author_member in (select public.my_member_ids())) or m.author_teacher = auth.uid(), false)))$p$;
    execute $p$create policy twin_read on storage.objects for select to authenticated using (
      bucket_id = 'twin' and public.can_read_twin_message(((storage.foldername(name))[2])::uuid))$p$;
  end if;
  -- القناة الخاصة لحركة القطع في الفسيفساء: أعضاء الصف المتبنّي فقط
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'realtime' and c.relname = 'messages') then
    execute $p$create policy grand_presence_read on realtime.messages for select to authenticated using (
      realtime.topic() like 'grand:%' and exists (select 1 from public.grand_claims gc where gc.section_id::text = substr(realtime.topic(), 7)
        and (public.is_class_member(gc.class_id) or public.is_class_teacher(gc.class_id))))$p$;
    execute $p$create policy grand_presence_write on realtime.messages for insert to authenticated with check (
      realtime.topic() like 'grand:%' and exists (select 1 from public.grand_claims gc where gc.section_id::text = substr(realtime.topic(), 7)
        and (public.is_class_member(gc.class_id) or public.is_class_teacher(gc.class_id))))$p$;
  end if;
end $$;

-- ═════════════════════ حذف التجريبي يشمل الفسيفساء الكبرى التجريبية ═════════════════════
create or replace function public.admin_purge_demo()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; n_items int; n_sources int; n_classes int; n_schools int; n_periods int; n_places int; n_leaves int; n_grand int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.grand_mosaics where is_demo; get diagnostics n_grand = row_count;
  delete from public.olive_leaves where is_demo; get diagnostics n_leaves = row_count;
  delete from public.items   where is_demo; get diagnostics n_items = row_count;
  delete from public.sources where is_demo and not exists (select 1 from public.item_sources s where s.source_id = sources.id)
    and not exists (select 1 from public.script_letters l where l.source_id = sources.id);
  get diagnostics n_sources = row_count;
  -- طلاب الصفوف التجريبية: حساباتهم أنشأها المعلم فتُحذف معها
  delete from auth.users u using public.class_members cm join public.classes c on c.id = cm.class_id
    where c.is_demo and cm.student_id = u.id and cm.login is not null;
  delete from public.classes where is_demo; get diagnostics n_classes = row_count;
  delete from public.schools where is_demo; get diagnostics n_schools = row_count;
  delete from public.periods where is_demo; get diagnostics n_periods = row_count;
  delete from public.places  where is_demo and not exists (select 1 from public.olive_leaves l where l.governorate_id = places.id);
  get diagnostics n_places = row_count;
  r := jsonb_build_object('grand', n_grand, 'leaves', n_leaves, 'items', n_items, 'sources', n_sources, 'classes', n_classes,
                          'schools', n_schools, 'periods', n_periods, 'places', n_places);
  perform public.audit('purge_demo', null, null, r);
  return r;
end $$;
