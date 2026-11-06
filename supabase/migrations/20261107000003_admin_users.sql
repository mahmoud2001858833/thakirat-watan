-- قائمة المستخدمين للمدير العام فقط (البريد في auth.users غير مكشوف عبر API)
create or replace function public.admin_list_users(p_query text default null, p_limit int default 50)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, is_minor boolean, roles jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select u.id, case when coalesce(p.is_minor, false) then null else u.email::text end, u.created_at, u.last_sign_in_at, coalesce(p.is_minor, false),
      coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'role', r.role, 'school_id', r.school_id, 'school', s.name) order by r.role)
                from public.user_roles r left join public.schools s on s.id = r.school_id
                where r.user_id = u.id), '[]'::jsonb)
    from auth.users u left join public.profiles p on p.id = u.id
    -- القاصرون: لا يُعرض بريدهم حتى للمدير في القائمة
    where p_query is null or p_query = '' or (not coalesce(p.is_minor, false) and u.email ilike '%' || p_query || '%')
    order by u.created_at desc
    limit least(coalesce(p_limit, 50), 200);
end $$;
revoke execute on function public.admin_list_users(text, int) from public, anon;
grant execute on function public.admin_list_users(text, int) to authenticated;
