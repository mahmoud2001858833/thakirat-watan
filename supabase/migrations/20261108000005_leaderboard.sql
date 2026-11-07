-- مختبر الترميم: لوحة أفضل الأزمنة (بلا أي بيانات شخصية) وترتيب اللاعب عند الإكمال
create or replace function public.finish_mosaic(p_slug text, p_moves int, p_seconds int)
returns int language plpgsql security definer set search_path = '' as $$
declare m uuid; g int; secs int; mv int;
begin
  select id, grid into m, g from public.mosaics where slug = p_slug and published;
  if m is null then return null; end if;
  -- حد أدنى معقول يمنع الأزمنة المزيفة: نصف ثانية ونصف حركة لكل قطعة
  secs := greatest(0, least(p_seconds, 86400)); mv := greatest(0, least(p_moves, 100000));
  if secs < (g * g) / 2 or mv < (g * g) / 2 then return null; end if;
  if not public.check_rate_limit('mosaic:' || coalesce(auth.uid()::text, 'anon') || ':' || p_slug, 30, 3600) then return null; end if;
  insert into public.mosaic_completions (mosaic_id, moves, seconds) values (m, mv, secs);
  return (select count(*)::int from public.mosaic_completions where mosaic_id = m and seconds < secs) + 1;
end $$;
grant execute on function public.finish_mosaic(text, int, int) to anon, authenticated;

create or replace function public.mosaic_leaderboard(p_slug text)
returns table (seconds int, moves int, created_at timestamptz) language sql stable security definer set search_path = '' as $$
  select c.seconds, c.moves, c.created_at from public.mosaic_completions c
  join public.mosaics m on m.id = c.mosaic_id and m.slug = p_slug and m.published
  order by c.seconds, c.moves, c.created_at limit 10
$$;
grant execute on function public.mosaic_leaderboard(text) to anon, authenticated;
create index if not exists mosaic_completions_rank on public.mosaic_completions (mosaic_id, seconds, moves);
