-- Le viste pubbliche devono essere di SOLA LETTURA. Di default Supabase concede
-- anche INSERT/UPDATE/DELETE ad anon/authenticated e tournaments_public (che
-- aggira la RLS) risultava scrivibile da chiunque.
revoke all on public.tournaments_public from anon, authenticated;
revoke all on public.ranking from anon, authenticated;
grant select on public.tournaments_public to anon, authenticated;
grant select on public.ranking to anon, authenticated;
