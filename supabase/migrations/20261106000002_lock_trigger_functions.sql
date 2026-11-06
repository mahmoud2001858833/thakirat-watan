-- دوال الـtriggers لا تُستدعى عبر RPC (الـtrigger يعمل دون صلاحية EXECUTE للمستدعي)
revoke execute on function public.tg_audit()       from public, anon, authenticated;
revoke execute on function public.tg_items_guard() from public, anon, authenticated;
revoke execute on function public.tg_new_user()    from public, anon, authenticated;
