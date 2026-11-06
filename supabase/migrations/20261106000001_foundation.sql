-- ذاكرة وطن — الأساس: الأدوار، المدارس، الأرشيف الأساسي، المراجعة، التدقيق، الإعدادات
-- كل جدول في public عليه RLS. الدوال الحساسة security definer مع search_path فارغ.

create extension if not exists pg_trgm with schema extensions;

-- ───────────────────────── الأنواع ─────────────────────────
create type public.app_role as enum ('admin','reviewer','school_admin','teacher','student','contributor');
create type public.content_status as enum ('draft','in_review','verified','published','rejected','archived');
create type public.trust_level as enum ('official_document','personal_testimony','circulated_account','under_review');
create type public.media_kind as enum ('image','audio','video','document','text');
create type public.rights_kind as enum ('public_domain','cc_by','cc_by_sa','cc_by_nc','permission','all_rights_reserved','unknown');
create type public.place_kind as enum ('governorate','district','locality','site');
create type public.source_kind as enum ('archive','publication','person','institution','web','other');
create type public.date_precision as enum ('day','month','year','decade','century','approx');
create type public.report_status as enum ('open','resolved','dismissed');
create type public.consent_method as enum ('in_app_signature','recorded_verbal','paper_scan');

-- ───────────────────────── تطبيع العربية للبحث ─────────────────────────
-- أ إ آ ٱ ← ا ، ة ← ه ، ى ← ي ، ؤ ← و ، ئ ← ي ، إزالة التشكيل والتطويل، أرقام مشرقية ← لاتينية
create or replace function public.ar_normalize(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(
    translate(
      regexp_replace(coalesce(t, ''), '[ً-ٰٟـ]', '', 'g'),
      'أإآٱةىؤئ٠١٢٣٤٥٦٧٨٩',
      'ااااهيوي0123456789'
    )
  )
$$;
-- ملاحظة: الأحرف المصدر 18 والهدف 18 بالترتيب: أ→ا إ→ا آ→ا ٱ→ا ة→ه ى→ي ؤ→و ئ→ي ثم الأرقام.

-- ───────────────────────── الملفات الشخصية والأدوار ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  locale text not null default 'ar' check (locale in ('ar','en')),
  is_minor boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'أقل قدر من البيانات. القاصر: لا بريد ظاهر ولا صورة ولا تاريخ ميلاد.';

create table public.places (
  id uuid primary key default gen_random_uuid(),
  kind public.place_kind not null,
  name_ar text not null check (char_length(name_ar) between 1 and 160),
  name_en text,
  parent_id uuid references public.places(id) on delete set null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  boundary jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.places (parent_id);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  place_id uuid references public.places(id) on delete set null,
  public_listing boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  school_id uuid references public.schools(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, school_id),
  check (role not in ('school_admin','teacher','student') or school_id is not null)
);
create index on public.user_roles (user_id);
create index on public.user_roles (school_id);

-- ───────────────────────── دوال الصلاحيات (تتجاوز RLS لتفادي الدوران) ─────────────────────────
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r)
$$;

create or replace function public.has_school_role(r public.app_role, s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r and school_id = s)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','reviewer'))
$$;

-- ───────────────────────── الصفوف ─────────────────────────
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  grade smallint check (grade between 1 and 12),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.classes (school_id);
create index on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  pseudonym text not null check (char_length(pseudonym) between 2 and 40),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index on public.class_members (student_id);
comment on table public.class_members is 'الطالب يُعرف باسم مستعار فقط. لا يظهر للعامة أبداً.';

create or replace function public.is_class_teacher(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes where id = c and teacher_id = auth.uid())
$$;

create or replace function public.is_class_school_admin(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes cl
    join public.user_roles ur on ur.school_id = cl.school_id and ur.role = 'school_admin'
    where cl.id = c and ur.user_id = auth.uid())
$$;

create or replace function public.is_class_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members where class_id = c and student_id = auth.uid())
$$;

-- هل المستخدم الحالي معلم لهذا الطالب؟
create or replace function public.teaches_student(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members cm join public.classes c on c.id = cm.class_id
    where cm.student_id = s and c.teacher_id = auth.uid())
$$;

-- ───────────────────────── الفترات الزمنية ─────────────────────────
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  start_year integer not null check (start_year >= -2600000), -- سالب = قبل الميلاد
  end_year integer not null,
  parent_id uuid references public.periods(id) on delete set null,
  is_demo boolean not null default false,
  check (end_year >= start_year)
);

-- ───────────────────────── المصادر ─────────────────────────
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  kind public.source_kind not null,
  citation text not null check (char_length(citation) between 3 and 1000),
  url text check (url is null or url ~* '^https?://'),
  archive_ref text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────────────────────── المواد (وحدة الأرشيف) ─────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  title_ar text not null check (char_length(title_ar) between 2 and 300),
  title_en text,
  summary_ar text check (char_length(summary_ar) <= 2000),
  summary_en text,
  body_ar text,
  body_en text,
  status public.content_status not null default 'draft',
  trust public.trust_level not null default 'under_review',
  rights public.rights_kind not null default 'unknown',
  rights_holder text,
  rights_note text,
  place_id uuid references public.places(id) on delete set null,
  period_id uuid references public.periods(id) on delete set null,
  year_start integer,
  year_end integer,
  date_exact date,
  date_precision public.date_precision,
  contributor_id uuid references auth.users(id) on delete set null default auth.uid(),
  contributor_public_name text check (char_length(contributor_public_name) <= 80),
  is_student_work boolean not null default false,
  reject_reason text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_norm text generated always as (
    public.ar_normalize(
      coalesce(title_ar,'') || ' ' || coalesce(summary_ar,'') || ' ' || coalesce(body_ar,'') || ' ' ||
      coalesce(title_en,'') || ' ' || coalesce(summary_en,''))
  ) stored,
  check (year_end is null or year_start is null or year_end >= year_start)
);
create index on public.items (status);
create index on public.items (contributor_id);
create index on public.items (place_id);
create index on public.items (period_id);
create index on public.items (year_start, year_end);
create index items_search_trgm on public.items using gin (search_norm extensions.gin_trgm_ops);

create table public.item_sources (
  item_id uuid not null references public.items(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  locator text, -- الصفحة/الدقيقة/رقم الوثيقة
  primary key (item_id, source_id)
);
create index on public.item_sources (source_id);

create table public.item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  kind public.media_kind not null,
  storage_path text,
  external_url text check (external_url is null or external_url ~* '^https://'),
  mime text not null,
  bytes bigint check (bytes > 0),
  width integer, height integer, duration_s numeric,
  blurhash text,
  alt_ar text, alt_en text,
  transcript_ar text, transcript_en text,
  captions_path text,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);
create index on public.item_media (item_id);

-- ───────────────────────── الموافقات ─────────────────────────
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  given_by uuid references auth.users(id) on delete set null default auth.uid(),
  subject_name_private text not null check (char_length(subject_name_private) between 2 and 120),
  consent_text_version text not null,
  consent_text text not null,
  method public.consent_method not null,
  evidence_path text,
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_reason text
);
create index on public.consents (item_id);
create index on public.consents (given_by);

-- ───────────────────────── المراجعة والبلاغات والنسخ ─────────────────────────
create table public.review_events (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  from_status public.content_status not null,
  to_status public.content_status not null,
  actor uuid references auth.users(id) on delete set null,
  reason text,
  at timestamptz not null default now()
);
create index on public.review_events (item_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  reason text not null check (reason in ('inaccurate','rights','privacy','offensive','other')),
  details text check (char_length(details) <= 2000),
  reporter_id uuid references auth.users(id) on delete set null default auth.uid(),
  status public.report_status not null default 'open',
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (status);

create table public.content_versions (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  data jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.content_versions (item_id, id desc);

-- ───────────────────────── الإعدادات وسجل التدقيق وحدود المعدل ─────────────────────────
create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value, is_public) values
  ('assistant.enabled', 'false', true),
  ('uploads.max_bytes', '209715200', true),
  ('capsule.open_date', '"2046-05-25"', true);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  table_name text,
  record_id text,
  details jsonb
);
create index on public.audit_log (at desc);
create index on public.audit_log (table_name, record_id);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- ───────────────────────── تفعيل RLS على كل الجداول ─────────────────────────
alter table public.profiles         enable row level security;
alter table public.places           enable row level security;
alter table public.schools          enable row level security;
alter table public.user_roles       enable row level security;
alter table public.classes          enable row level security;
alter table public.class_members    enable row level security;
alter table public.periods          enable row level security;
alter table public.sources          enable row level security;
alter table public.items            enable row level security;
alter table public.item_sources     enable row level security;
alter table public.item_media       enable row level security;
alter table public.consents         enable row level security;
alter table public.review_events    enable row level security;
alter table public.reports          enable row level security;
alter table public.content_versions enable row level security;
alter table public.settings         enable row level security;
alter table public.audit_log        enable row level security;
alter table public.rate_limits      enable row level security;

-- يمكن رؤية المادة؟ (تستخدم في سياسات الجداول التابعة)
create or replace function public.can_read_item(i uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items it where it.id = i and (
      it.status = 'published'
      or it.contributor_id = auth.uid()
      or public.is_staff()
      or (it.is_student_work and public.teaches_student(it.contributor_id))))
$$;

create or replace function public.can_edit_item(i uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.items it where it.id = i and (
      public.is_staff()
      or (it.contributor_id = auth.uid() and it.status in ('draft','rejected'))))
$$;

-- profiles
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- places / periods: قراءة عامة، كتابة للطاقم
create policy places_select on public.places for select using (true);
create policy places_write  on public.places for all using (public.is_staff()) with check (public.is_staff());
create policy periods_select on public.periods for select using (true);
create policy periods_write  on public.periods for all using (public.is_staff()) with check (public.is_staff());

-- schools
create policy schools_select on public.schools for select using (
  public_listing or public.is_staff()
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.school_id = schools.id));
create policy schools_insert on public.schools for insert with check (public.is_admin());
create policy schools_update on public.schools for update
  using (public.is_admin() or public.has_school_role('school_admin', id))
  with check (public.is_admin() or public.has_school_role('school_admin', id));
create policy schools_delete on public.schools for delete using (public.is_admin());

-- user_roles: المدير يمنح كل شيء؛ مدير المدرسة يمنح «معلم» داخل مدرسته فقط
create policy roles_select on public.user_roles for select using (
  user_id = auth.uid() or public.is_admin()
  or (school_id is not null and public.has_school_role('school_admin', school_id)));
create policy roles_insert on public.user_roles for insert with check (
  public.is_admin()
  or (role = 'teacher' and public.has_school_role('school_admin', school_id)));
create policy roles_delete on public.user_roles for delete using (
  public.is_admin()
  or (role = 'teacher' and public.has_school_role('school_admin', school_id)));

-- classes
create policy classes_select on public.classes for select using (
  teacher_id = auth.uid() or public.is_admin()
  or public.has_school_role('school_admin', school_id)
  or public.is_class_member(id));
create policy classes_insert on public.classes for insert with check (
  teacher_id = auth.uid() and public.has_school_role('teacher', school_id));
create policy classes_update on public.classes for update
  using (teacher_id = auth.uid() or public.has_school_role('school_admin', school_id))
  with check (public.has_school_role('teacher', school_id) or public.has_school_role('school_admin', school_id));
create policy classes_delete on public.classes for delete using (
  teacher_id = auth.uid() or public.has_school_role('school_admin', school_id) or public.is_admin());

-- class_members
create policy members_select on public.class_members for select using (
  student_id = auth.uid() or public.is_class_teacher(class_id)
  or public.is_class_school_admin(class_id) or public.is_admin());
create policy members_delete on public.class_members for delete using (
  public.is_class_teacher(class_id) or public.is_admin());
-- الإضافة عبر join_class() فقط

-- sources: تظهر للعامة إن ارتبطت بمادة منشورة
create policy sources_select on public.sources for select using (
  public.is_staff() or created_by = auth.uid()
  or exists (select 1 from public.item_sources s join public.items i on i.id = s.item_id
             where s.source_id = sources.id and i.status = 'published'));
create policy sources_insert on public.sources for insert with check (
  auth.uid() is not null and created_by = auth.uid());
create policy sources_update on public.sources for update using (public.is_staff()) with check (public.is_staff());
create policy sources_delete on public.sources for delete using (public.is_admin());

-- items
create policy items_select on public.items for select using (
  status = 'published' or contributor_id = auth.uid() or public.is_staff()
  or (is_student_work and public.teaches_student(contributor_id)));
create policy items_insert on public.items for insert with check (
  contributor_id = auth.uid()
  and (public.has_role('contributor') or public.has_role('student') or public.is_staff()));
create policy items_update on public.items for update
  using (public.is_staff() or (contributor_id = auth.uid() and status in ('draft','rejected')))
  with check (public.is_staff() or contributor_id = auth.uid());
create policy items_delete on public.items for delete using (
  public.is_admin() or (contributor_id = auth.uid() and status = 'draft'));

-- item_sources / item_media تتبع المادة
create policy isrc_select on public.item_sources for select using (public.can_read_item(item_id));
create policy isrc_write  on public.item_sources for all using (public.can_edit_item(item_id)) with check (public.can_edit_item(item_id));
create policy imedia_select on public.item_media for select using (public.can_read_item(item_id));
create policy imedia_write  on public.item_media for all using (public.can_edit_item(item_id)) with check (public.can_edit_item(item_id));

-- consents: لا تظهر للعامة أبداً
create policy consents_select on public.consents for select using (given_by = auth.uid() or public.is_staff());
create policy consents_insert on public.consents for insert with check (
  given_by = auth.uid() and public.can_edit_item(item_id));
-- السحب عبر withdraw_consent() فقط

-- review_events: للطاقم ولصاحب المادة
create policy review_select on public.review_events for select using (
  public.is_staff() or exists (select 1 from public.items i where i.id = item_id and i.contributor_id = auth.uid()));

-- reports: أي أحد يبلّغ (بما فيه الزائر)، الطاقم يرى ويعالج
create policy reports_insert on public.reports for insert with check (
  status = 'open' and handled_by is null
  and (reporter_id is null or reporter_id = auth.uid())
  and public.can_read_item(item_id));
create policy reports_select on public.reports for select using (public.is_staff() or reporter_id = auth.uid());
create policy reports_update on public.reports for update using (public.is_staff()) with check (public.is_staff());

-- content_versions: الطاقم
create policy versions_select on public.content_versions for select using (public.is_staff());

-- settings
create policy settings_select on public.settings for select using (is_public or public.is_admin());
create policy settings_write on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- audit_log: قراءة للمدير فقط، لا كتابة لأحد (الإدراج عبر triggers)
create policy audit_select on public.audit_log for select using (public.is_admin());
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
-- rate_limits: لا سياسات = لا وصول مباشر، فقط check_rate_limit()
revoke all on public.rate_limits from anon, authenticated;

-- ───────────────────────── التدقيق ─────────────────────────
create or replace function public.audit(p_action text, p_table text, p_record text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor, action, table_name, record_id, details)
  values (auth.uid(), p_action, p_table, p_record, p_details)
$$;
revoke execute on function public.audit(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare rec jsonb;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.audit(lower(tg_op), tg_table_name,
    coalesce(rec->>'id', rec->>'key', rec->>'user_id'),
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else rec end);
  return null;
end $$;

create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.tg_audit();
create trigger audit_settings  after insert or update or delete on public.settings   for each row execute function public.tg_audit();
create trigger audit_schools   after insert or update or delete on public.schools    for each row execute function public.tg_audit();
create trigger audit_consents  after insert or update or delete on public.consents   for each row execute function public.tg_audit();
create trigger audit_items_del after delete on public.items for each row execute function public.tg_audit();

-- ───────────────────────── حماية حقول المادة ─────────────────────────
create or replace function public.tg_items_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  -- أي عمل طالب يُعلَّم تلقائياً، ولا يُعرض اسمه للعامة أبداً
  if exists (select 1 from public.user_roles where user_id = new.contributor_id and role = 'student') then
    new.is_student_work := true;
  end if;
  if new.is_student_work then new.contributor_public_name := null; end if;

  if tg_op = 'INSERT' then
    if uid is not null and not public.is_staff() then
      new.status := 'draft'; new.trust := 'under_review'; new.is_demo := false;
      new.verified_by := null; new.verified_at := null; new.published_by := null; new.published_at := null;
      new.reject_reason := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status
     and coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    raise exception 'status changes must go through transition_status()' using errcode = '42501';
  end if;
  if uid is not null and not public.is_staff() then
    new.trust := old.trust; new.is_demo := old.is_demo; new.contributor_id := old.contributor_id;
    new.verified_by := old.verified_by; new.verified_at := old.verified_at;
    new.published_by := old.published_by; new.published_at := old.published_at;
    new.reject_reason := old.reject_reason; new.is_student_work := old.is_student_work or new.is_student_work;
  end if;
  new.updated_at := now();
  -- نسخة قابلة للاسترجاع من الحالة السابقة
  insert into public.content_versions (item_id, data, created_by) values (old.id, to_jsonb(old) - 'search_norm', uid);
  return new;
end $$;
create trigger items_guard before insert or update on public.items for each row execute function public.tg_items_guard();

-- ───────────────────────── انتقالات الحالة ─────────────────────────
create or replace function public.transition_status(p_item uuid, p_to public.content_status, p_reason text default null)
returns public.content_status language plpgsql security definer set search_path = '' as $$
declare
  it public.items;
  uid uuid := auth.uid();
  staff boolean := public.is_staff();
  owner boolean;
begin
  select * into it from public.items where id = p_item for update;
  if not found then raise exception 'item not found' using errcode = 'P0002'; end if;
  owner := it.contributor_id = uid;

  if not (
    -- صاحب المادة
    (owner and (it.status, p_to) in (('draft','in_review'), ('in_review','draft'), ('rejected','draft')))
    -- الطاقم
    or (staff and (it.status, p_to) in (
        ('in_review','verified'), ('verified','published'), ('in_review','rejected'),
        ('verified','rejected'), ('published','archived'), ('archived','published'),
        ('verified','in_review'), ('draft','in_review'), ('published','in_review')))
    -- المدير: أي انتقال
    or public.is_admin()
  ) then
    raise exception 'transition % -> % not allowed', it.status, p_to using errcode = '42501';
  end if;

  if p_to = 'rejected' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'rejection requires a reason' using errcode = '22023';
  end if;

  if p_to in ('verified','published') then
    if it.trust = 'under_review' then raise exception 'set trust level before verifying' using errcode = '22023'; end if;
    if it.rights = 'unknown' then raise exception 'set usage rights before verifying' using errcode = '22023'; end if;
    if not exists (select 1 from public.item_sources where item_id = it.id) then
      raise exception 'at least one source is required' using errcode = '22023';
    end if;
    if it.trust = 'personal_testimony' and not exists (
      select 1 from public.consents where item_id = it.id and withdrawn_at is null) then
      raise exception 'personal testimony requires active documented consent' using errcode = '22023';
    end if;
  end if;

  perform set_config('app.in_transition', 'on', true);
  update public.items set
    status = p_to,
    reject_reason = case when p_to = 'rejected' then p_reason else null end,
    verified_by  = case when p_to = 'verified'  then uid else verified_by end,
    verified_at  = case when p_to = 'verified'  then now() else verified_at end,
    published_by = case when p_to = 'published' then uid else published_by end,
    published_at = case when p_to = 'published' then now() else published_at end
  where id = it.id;
  perform set_config('app.in_transition', 'off', true);

  insert into public.review_events (item_id, from_status, to_status, actor, reason)
  values (it.id, it.status, p_to, uid, p_reason);
  perform public.audit('transition', 'items', it.id::text,
    jsonb_build_object('from', it.status, 'to', p_to, 'reason', p_reason));
  return p_to;
end $$;

-- ───────────────────────── سحب الموافقة ─────────────────────────
create or replace function public.withdraw_consent(p_consent uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.consents; prev public.content_status;
begin
  select * into c from public.consents where id = p_consent for update;
  if not found or not (c.given_by = auth.uid() or public.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.consents set withdrawn_at = now(), withdrawn_reason = p_reason where id = c.id and withdrawn_at is null;
  -- إخفاء فوري إن لم تبق موافقة سارية
  if not exists (select 1 from public.consents where item_id = c.item_id and withdrawn_at is null) then
    select status into prev from public.items where id = c.item_id;
    perform set_config('app.in_transition', 'on', true);
    update public.items set status = 'archived' where id = c.item_id and status <> 'archived';
    perform set_config('app.in_transition', 'off', true);
    insert into public.review_events (item_id, from_status, to_status, actor, reason)
      select c.item_id, prev, 'archived', auth.uid(), 'consent withdrawn'
      where prev is not null and prev <> 'archived';
  end if;
  perform public.audit('consent_withdrawn', 'consents', c.id::text, jsonb_build_object('item', c.item_id));
end $$;

-- ───────────────────────── الانضمام لصف برمز ─────────────────────────
create or replace function public.join_class(p_code text, p_pseudonym text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.classes;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not public.check_rate_limit('join:' || auth.uid()::text, 10, 3600) then
    raise exception 'too many attempts' using errcode = '54000';
  end if;
  select * into c from public.classes where join_code = upper(btrim(p_code));
  -- لا نرفع استثناءً هنا حتى لا يُلغى عدّاد المحاولات مع التراجع
  if not found then return null; end if;
  insert into public.user_roles (user_id, role, school_id) values (auth.uid(), 'student', c.school_id)
    on conflict do nothing;
  insert into public.class_members (class_id, student_id, pseudonym) values (c.id, auth.uid(), btrim(p_pseudonym))
    on conflict (class_id, student_id) do update set pseudonym = excluded.pseudonym;
  update public.profiles set is_minor = true where id = auth.uid();
  return c.id;
end $$;

-- ───────────────────────── حدود المعدل ─────────────────────────
create or replace function public.check_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        n integer;
begin
  insert into public.rate_limits (bucket, window_start, hits) values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;

-- ───────────────────────── استرجاع نسخة ─────────────────────────
create or replace function public.admin_restore_version(p_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.content_versions; d jsonb;
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from public.content_versions where id = p_version;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;
  d := v.data;
  -- يسترجع المحتوى فقط؛ الحالة تبقى كما هي (تُغيَّر عبر transition_status)
  update public.items set
    title_ar = d->>'title_ar', title_en = d->>'title_en',
    summary_ar = d->>'summary_ar', summary_en = d->>'summary_en',
    body_ar = d->>'body_ar', body_en = d->>'body_en',
    trust = (d->>'trust')::public.trust_level, rights = (d->>'rights')::public.rights_kind,
    rights_holder = d->>'rights_holder', rights_note = d->>'rights_note',
    place_id = (d->>'place_id')::uuid, period_id = (d->>'period_id')::uuid,
    year_start = (d->>'year_start')::int, year_end = (d->>'year_end')::int,
    date_exact = (d->>'date_exact')::date, date_precision = (d->>'date_precision')::public.date_precision
  where id = v.item_id;
  perform public.audit('restore_version', 'items', v.item_id::text, jsonb_build_object('version', p_version));
end $$;

-- ───────────────────────── حذف التجريبي بأمر واحد ─────────────────────────
create or replace function public.admin_purge_demo()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; n_items int; n_sources int; n_classes int; n_schools int; n_periods int; n_places int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.items   where is_demo; get diagnostics n_items = row_count;
  delete from public.sources where is_demo and not exists (select 1 from public.item_sources s where s.source_id = sources.id);
  get diagnostics n_sources = row_count;
  delete from public.classes where is_demo; get diagnostics n_classes = row_count;
  delete from public.schools where is_demo; get diagnostics n_schools = row_count;
  delete from public.periods where is_demo; get diagnostics n_periods = row_count;
  delete from public.places  where is_demo; get diagnostics n_places = row_count;
  r := jsonb_build_object('items', n_items, 'sources', n_sources, 'classes', n_classes,
                          'schools', n_schools, 'periods', n_periods, 'places', n_places);
  perform public.audit('purge_demo', null, null, r);
  return r;
end $$;

-- ───────────────────────── مستخدم جديد ─────────────────────────
create or replace function public.tg_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'contributor') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.tg_new_user();

-- ───────────────────────── البحث العربي ─────────────────────────
create or replace function public.search_items(
  q text, p_place uuid default null, p_period uuid default null, p_kind public.media_kind default null,
  p_trust public.trust_level default null, p_year_from int default null, p_year_to int default null,
  p_limit int default 24, p_offset int default 0)
returns setof public.items language sql stable security invoker set search_path = '' as $$
  with nq as (select public.ar_normalize(q) as v)
  select i.* from public.items i, nq
  where i.status = 'published'
    and (nq.v = '' or i.search_norm operator(extensions.%) nq.v or i.search_norm like '%' || nq.v || '%')
    and (p_place  is null or i.place_id = p_place)
    and (p_period is null or i.period_id = p_period)
    and (p_kind   is null or i.kind = p_kind)
    and (p_trust  is null or i.trust = p_trust)
    and (p_year_from is null or coalesce(i.year_end, i.year_start) >= p_year_from)
    and (p_year_to   is null or i.year_start <= p_year_to)
  order by (i.search_norm like '%' || nq.v || '%') desc,
           extensions.similarity(i.search_norm, nq.v) desc, i.published_at desc nulls last
  limit least(p_limit, 100) offset p_offset
$$;

-- الدوال الإدارية لا تُستدعى من الزائر
revoke execute on function public.admin_purge_demo() from public, anon;
revoke execute on function public.admin_restore_version(bigint) from public, anon;
revoke execute on function public.withdraw_consent(uuid, text) from public, anon;
revoke execute on function public.join_class(text, text) from public, anon;
revoke execute on function public.transition_status(uuid, public.content_status, text) from public, anon;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_purge_demo() to authenticated;
grant execute on function public.admin_restore_version(bigint) to authenticated;
grant execute on function public.withdraw_consent(uuid, text) to authenticated;
grant execute on function public.join_class(text, text) to authenticated;
grant execute on function public.transition_status(uuid, public.content_status, text) to authenticated;
