-- الميزات الخمس: الأرشيف، هذا اليوم، اكتب اسمك، مختبر الترميم، زيتونة الوطن

-- ───────────── المواد: أحداث، ومصدر الإعداد ─────────────
alter table public.items
  add column is_event boolean not null default false,
  add column provenance text not null default 'contributor'
    check (provenance in ('contributor','staff','assistant_research')),
  add column featured boolean not null default false;
comment on column public.items.provenance is 'assistant_research = أعدّها المساعد من مصادر مفتوحة، بانتظار مراجعة الأمين';
create index items_event_day on public.items ((extract(month from date_exact)), (extract(day from date_exact))) where is_event;

alter table public.item_media
  add column credit text,
  add column license text,
  add column license_url text,
  add column source_url text,
  add column blur text;

alter table public.places add column key text unique;
alter table public.periods add column key text unique;

-- ───────────── هذا اليوم في الأردن ─────────────
create or replace function public.this_day(p_month int, p_day int)
returns setof public.items language sql stable security invoker set search_path = '' as $$
  select * from public.items
  where is_event and status = 'published' and date_exact is not null
    and extract(month from date_exact) = p_month and extract(day from date_exact) = p_day
  order by date_exact
$$;

-- أيام السنة التي فيها أحداث منشورة (للتنقل)
create or replace function public.event_days()
returns table (m int, d int, n int) language sql stable security invoker set search_path = '' as $$
  select extract(month from date_exact)::int, extract(day from date_exact)::int, count(*)::int
  from public.items where is_event and status = 'published' and date_exact is not null
  group by 1, 2 order by 1, 2
$$;

-- ───────────── اكتب اسمك بخط أجدادك ─────────────
create table public.script_letters (
  id bigint generated always as identity primary key,
  script text not null check (script in ('safaitic','nabataean','moabite')),
  position smallint not null,
  arabic text not null,              -- الحروف العربية التي يقابلها، مثل 'ت,ث'
  codepoint integer not null,        -- رمز Unicode للحرف
  name text not null,                -- الاسم الرسمي في Unicode
  translit text not null,            -- النقحرة العلمية
  note_ar text,
  source_id uuid references public.sources(id) on delete set null,
  unique (script, codepoint)
);
alter table public.script_letters enable row level security;
create policy letters_select on public.script_letters for select using (true);
create policy letters_write on public.script_letters for all using (public.is_staff()) with check (public.is_staff());
create trigger audit_letters after update or delete on public.script_letters for each row execute function public.tg_audit();

-- ───────────── مختبر الترميم ─────────────
create table public.mosaics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title_ar text not null,
  summary_ar text not null,
  item_id uuid references public.items(id) on delete set null,
  image_path text not null,
  credit text not null,
  license text not null,
  license_url text,
  source_url text not null,
  grid smallint not null default 4 check (grid between 3 and 8),
  published boolean not null default false,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
create table public.mosaic_completions (
  id bigint generated always as identity primary key,
  mosaic_id uuid not null references public.mosaics(id) on delete cascade,
  moves integer not null check (moves between 0 and 100000),
  seconds integer not null check (seconds between 0 and 86400),
  created_at timestamptz not null default now()
);
create index on public.mosaic_completions (mosaic_id);
alter table public.mosaics enable row level security;
alter table public.mosaic_completions enable row level security;
create policy mosaics_select on public.mosaics for select using (published or public.is_staff());
create policy mosaics_write on public.mosaics for all using (public.is_staff()) with check (public.is_staff());
create policy completions_select on public.mosaic_completions for select using (public.is_staff());
revoke insert, update, delete on public.mosaic_completions from anon, authenticated;
create trigger audit_mosaics after insert or update or delete on public.mosaics for each row execute function public.tg_audit();

-- تسجيل إكمال لوحة (بلا بيانات شخصية، بحد معدل لكل لوحة)
create or replace function public.record_mosaic_completion(p_slug text, p_moves int, p_seconds int)
returns void language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  select id into m from public.mosaics where slug = p_slug and published;
  if m is null then return; end if;
  if not public.check_rate_limit('mosaic:' || coalesce(auth.uid()::text, 'anon') || ':' || p_slug, 30, 3600) then return; end if;
  insert into public.mosaic_completions (mosaic_id, moves, seconds)
  values (m, greatest(0, least(p_moves, 100000)), greatest(0, least(p_seconds, 86400)));
end $$;
grant execute on function public.record_mosaic_completion(text, int, int) to anon, authenticated;

-- ───────────── زيتونة الوطن ─────────────
create type public.leaf_status as enum ('pending','published','rejected');
create table public.olive_leaves (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 2 and 280),
  governorate_id uuid not null references public.places(id),
  school_id uuid references public.schools(id) on delete set null,
  author_id uuid references auth.users(id) on delete cascade default auth.uid(),
  display_name text check (char_length(display_name) <= 40),
  status public.leaf_status not null default 'pending',
  is_demo boolean not null default false,
  reject_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.olive_leaves (status, governorate_id);
create index on public.olive_leaves (author_id);
alter table public.olive_leaves enable row level security;
create policy leaves_select on public.olive_leaves for select using (
  status = 'published' or author_id = auth.uid() or public.is_staff());
create policy leaves_insert on public.olive_leaves for insert with check (
  auth.uid() is not null and author_id = auth.uid());
create policy leaves_delete on public.olive_leaves for delete using (
  public.is_admin() or (author_id = auth.uid() and status = 'pending'));
-- لا يُكشف صاحب الورقة ولا مراجعها: الأعمدة الظاهرة محددة
revoke select, update on public.olive_leaves from anon, authenticated;
grant select (id, body, governorate_id, school_id, display_name, status, is_demo, created_at) on public.olive_leaves to anon, authenticated;

create or replace function public.tg_leaf_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pseudo text; sch uuid;
begin
  if uid is not null and not public.is_staff() then
    if not public.check_rate_limit('leaf:' || uid::text, 10, 86400) then
      raise exception 'too many attempts' using errcode = '54000';
    end if;
    new.status := 'pending'; new.is_demo := false; new.author_id := uid;
    new.reviewed_by := null; new.reviewed_at := null; new.reject_reason := null;
  end if;
  -- الطالب: اسم مستعار من صفه فقط، ومدرسته من صفه
  select cm.pseudonym, c.school_id into pseudo, sch
    from public.class_members cm join public.classes c on c.id = cm.class_id
    where cm.student_id = new.author_id order by cm.joined_at limit 1;
  if pseudo is not null then
    new.display_name := pseudo; new.school_id := sch;
  elsif new.display_name is not null then
    -- غير الطالب: الاسم الأول فقط
    new.display_name := nullif(split_part(btrim(new.display_name), ' ', 1), '');
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
create trigger leaf_guard before insert on public.olive_leaves for each row execute function public.tg_leaf_guard();
revoke execute on function public.tg_leaf_guard() from public, anon, authenticated;

create or replace function public.review_leaf(p_leaf uuid, p_approve boolean, p_reason text default null)
returns public.leaf_status language plpgsql security definer set search_path = '' as $$
declare st public.leaf_status;
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'rejection requires a reason' using errcode = '22023';
  end if;
  update public.olive_leaves set
    status = case when p_approve then 'published'::public.leaf_status else 'rejected'::public.leaf_status end,
    reject_reason = case when p_approve then null else p_reason end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_leaf returning status into st;
  if st is null then raise exception 'leaf not found' using errcode = 'P0002'; end if;
  perform public.audit('review_leaf', 'olive_leaves', p_leaf::text, jsonb_build_object('status', st, 'reason', p_reason));
  return st;
end $$;
revoke execute on function public.review_leaf(uuid, boolean, text) from public, anon;
grant execute on function public.review_leaf(uuid, boolean, text) to authenticated;

-- حالة الشجرة تُحسب هنا لا في المتصفح: الأغصان والإزهار والزيتون الذهبي والفصل
create or replace function public.olive_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with pub as (select governorate_id from public.olive_leaves where status = 'published'),
       t as (select count(*)::int n from pub),
       g as (select coalesce(jsonb_object_agg(governorate_id, n), '{}'::jsonb) j
             from (select governorate_id, count(*)::int n from pub group by 1) x),
       mo as (select extract(month from now() at time zone 'Asia/Amman')::int m)
  select jsonb_build_object(
    'total', t.n,
    'branches', t.n / 100,
    'blooming', t.n >= 1000,
    'golden', t.n >= 5000,
    'by_governorate', g.j,
    'season', case when mo.m in (3,4,5) then 'spring' when mo.m in (6,7,8) then 'summer'
                   when mo.m in (9,10,11) then 'autumn' else 'winter' end)
  from t, g, mo
$$;

-- ───────────── حذف التجريبي يشمل الأوراق ─────────────
create or replace function public.admin_purge_demo()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; n_items int; n_sources int; n_classes int; n_schools int; n_periods int; n_places int; n_leaves int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.olive_leaves where is_demo; get diagnostics n_leaves = row_count;
  delete from public.items   where is_demo; get diagnostics n_items = row_count;
  delete from public.sources where is_demo and not exists (select 1 from public.item_sources s where s.source_id = sources.id)
    and not exists (select 1 from public.script_letters l where l.source_id = sources.id);
  get diagnostics n_sources = row_count;
  delete from public.classes where is_demo; get diagnostics n_classes = row_count;
  delete from public.schools where is_demo; get diagnostics n_schools = row_count;
  delete from public.periods where is_demo; get diagnostics n_periods = row_count;
  delete from public.places  where is_demo and not exists (select 1 from public.olive_leaves l where l.governorate_id = places.id);
  get diagnostics n_places = row_count;
  r := jsonb_build_object('leaves', n_leaves, 'items', n_items, 'sources', n_sources, 'classes', n_classes,
                          'schools', n_schools, 'periods', n_periods, 'places', n_places);
  perform public.audit('purge_demo', null, null, r);
  return r;
end $$;

-- ───────────── المحافظات الاثنتا عشرة والفترات ─────────────
-- الإحداثيات تقريبية لمراكز المحافظات. المصدر: https://en.wikipedia.org/wiki/Governorates_of_Jordan
insert into public.places (key, kind, name_ar, name_en, lat, lng) values
  ('amman','governorate','العاصمة (عمّان)','Amman',31.95,35.93),
  ('irbid','governorate','إربد','Irbid',32.55,35.85),
  ('zarqa','governorate','الزرقاء','Zarqa',32.07,36.09),
  ('balqa','governorate','البلقاء','Balqa',32.04,35.73),
  ('mafraq','governorate','المفرق','Mafraq',32.34,36.21),
  ('karak','governorate','الكرك','Karak',31.18,35.70),
  ('jerash','governorate','جرش','Jerash',32.28,35.90),
  ('madaba','governorate','مادبا','Madaba',31.72,35.79),
  ('ajloun','governorate','عجلون','Ajloun',32.33,35.75),
  ('aqaba','governorate','العقبة','Aqaba',29.53,35.01),
  ('maan','governorate','معان','Ma''an',30.19,35.73),
  ('tafilah','governorate','الطفيلة','Tafilah',30.84,35.60);

-- الفترات بحدود تقريبية. المصدر: https://en.wikipedia.org/wiki/History_of_Jordan
insert into public.periods (key, name_ar, name_en, start_year, end_year) values
  ('prehistoric','ما قبل التاريخ','Prehistory',-2500000,-1200),
  ('iron','العصر الحديدي (مؤاب وعمّون وأدوم)','Iron Age',-1200,-332),
  ('nabataean','العصر النبطي','Nabataean',-312,106),
  ('roman','العصر الروماني','Roman',-63,324),
  ('byzantine','العصر البيزنطي','Byzantine',324,636),
  ('early-islamic','العصر الإسلامي المبكر والأموي','Early Islamic & Umayyad',636,750),
  ('medieval','العصر الأيوبي والمملوكي','Ayyubid & Mamluk',1171,1516),
  ('ottoman','العصر العثماني','Ottoman',1516,1918),
  ('emirate','إمارة شرق الأردن','Emirate of Transjordan',1921,1946),
  ('kingdom','المملكة الأردنية الهاشمية','Hashemite Kingdom',1946,2100);
