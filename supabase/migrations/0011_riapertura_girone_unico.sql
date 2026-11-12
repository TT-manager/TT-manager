-- Riapertura: un torneo senza tabellone (girone unico) torna a "gironi in corso".
create or replace function public.reopen_tournament(p_tournament uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_max bigint;
begin
  perform pg_advisory_xact_lock(hashtext('tt_ratings'));
  perform 1 from tournaments where id = p_tournament and status = 'closed' for update;
  if not found then raise exception 'TORNEO_NON_CHIUSO'; end if;
  perform 1 from players where id in (select player_id from rating_history where tournament_id = p_tournament) for update;
  select max(id) into v_max from rating_history where tournament_id = p_tournament;
  if v_max is not null and exists (
    select 1 from rating_history h
     where h.id > v_max and h.player_id in (select player_id from rating_history where tournament_id = p_tournament)
  ) then
    raise exception 'TORNEI_SUCCESSIVI';
  end if;
  update players pl set rating = f.first_before, games_played = pl.games_played - f.n
    from (select player_id, count(*) as n, (array_agg(rating_before order by id))[1] as first_before
            from rating_history where tournament_id = p_tournament group by player_id) f
   where pl.id = f.player_id;
  delete from rating_history where tournament_id = p_tournament;
  update matches set rated = false where tournament_id = p_tournament;
  update tournaments set status = case
      when exists (select 1 from matches where tournament_id = p_tournament and phase = 'group' and sets_a is null)
        or not exists (select 1 from matches where tournament_id = p_tournament and phase = 'knockout')
      then 'groups' else 'knockout' end
   where id = p_tournament;
end $$;
revoke all on function public.reopen_tournament(uuid) from public, anon, authenticated;
grant execute on function public.reopen_tournament(uuid) to service_role;
