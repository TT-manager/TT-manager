-- Circuiti non pubblici: classifica, punti, storico e albo d'oro li vedono solo
-- i membri del circuito e gli amministratori. I circuiti pubblici restano visibili a tutti.

create or replace function private.can_see_championship(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championships c where c.id = cid and c.is_public)
      or private.is_admin()
      or exists (select 1 from public.championship_players cp
                   join public.players p on p.id = cp.player_id
                  where cp.championship_id = cid and p.user_id = auth.uid());
$$;
revoke all on function private.can_see_championship(uuid) from public;
grant execute on function private.can_see_championship(uuid) to anon, authenticated;

-- Per le pagine: «posso vedere questo circuito?»
create or replace function public.championship_visible(cid uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.can_see_championship(cid);
$$;
grant execute on function public.championship_visible(uuid) to anon, authenticated;

drop policy if exists "read" on public.championship_players;
create policy "read" on public.championship_players for select using (private.can_see_championship(championship_id));

drop policy if exists "history read" on public.rating_history;
create policy "history read" on public.rating_history for select using (private.can_see_championship(championship_id));

drop policy if exists "read" on public.past_tournaments;
create policy "read" on public.past_tournaments for select using (private.can_see_championship(championship_id));

drop policy if exists "read" on public.past_results;
create policy "read" on public.past_results for select using (
  private.can_see_championship((select pt.championship_id from public.past_tournaments pt where pt.id = past_results.past_tournament_id)));
