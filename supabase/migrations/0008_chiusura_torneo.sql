-- Chiusura torneo (applicazione Elo) e riapertura, in modo atomico e idempotente.
-- L'Elo è calcolato dall'app (src/lib/domain/elo.ts); qui si verifica che nulla sia
-- cambiato nel frattempo e si scrive tutto in un'unica transazione.
-- Eseguibili SOLO con la chiave segreta (service_role), mai dal browser.

create or replace function public.apply_tournament_ratings(p_tournament uuid, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_ids uuid[] := array(select (x)::uuid from jsonb_array_elements_text(p_payload->'matches') x);
  v_ok int;
  p jsonb;
begin
  perform 1 from tournaments where id = p_tournament and status in ('groups', 'knockout') for update;
  if not found then raise exception 'TORNEO_NON_CHIUDIBILE'; end if;

  -- Tutte le partite indicate devono essere di questo torneo, giocate e non ancora conteggiate.
  perform 1 from matches where id = any(v_ids) for update;
  select count(*) into v_ok from matches
   where id = any(v_ids) and tournament_id = p_tournament and rated = false
     and sets_a is not null and sets_b is not null;
  if v_ok <> coalesce(array_length(v_ids, 1), 0) then raise exception 'PARTITE_CAMBIATE'; end if;
  -- Nessuna partita giocata e non conteggiata deve restare fuori.
  if exists (select 1 from matches where tournament_id = p_tournament and rated = false
             and sets_a is not null and not (id = any(v_ids))) then
    raise exception 'PARTITE_CAMBIATE';
  end if;

  -- Rating aggiornati solo se nessuno li ha modificati nel frattempo.
  for p in select * from jsonb_array_elements(p_payload->'players') loop
    update players set rating = (p->>'ratingAfter')::int, games_played = (p->>'gamesAfter')::int
     where id = (p->>'id')::uuid and rating = (p->>'ratingBefore')::int and games_played = (p->>'gamesBefore')::int;
    if not found then raise exception 'RATING_CAMBIATO'; end if;
  end loop;

  insert into rating_history (player_id, tournament_id, match_id, rating_before, rating_after)
  select (h->>'playerId')::uuid, p_tournament, (h->>'matchId')::uuid, (h->>'before')::int, (h->>'after')::int
    from jsonb_array_elements(p_payload->'history') with ordinality as t(h, n) order by n;

  update matches set rated = true where id = any(v_ids);
  update tournaments set status = 'closed' where id = p_tournament;
end $$;

-- Riapre un torneo chiuso annullando esattamente le sue variazioni Elo.
-- Possibile solo se è l'ultimo torneo conteggiato per tutti i suoi giocatori.
create or replace function public.reopen_tournament(p_tournament uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_max bigint;
begin
  perform 1 from tournaments where id = p_tournament and status = 'closed' for update;
  if not found then raise exception 'TORNEO_NON_CHIUSO'; end if;
  select max(id) into v_max from rating_history where tournament_id = p_tournament;
  if v_max is not null and exists (
    select 1 from rating_history h
     where h.id > v_max and h.player_id in (select player_id from rating_history where tournament_id = p_tournament)
  ) then
    raise exception 'TORNEI_SUCCESSIVI';
  end if;

  perform 1 from players where id in (select player_id from rating_history where tournament_id = p_tournament) for update;
  update players pl set rating = f.first_before, games_played = pl.games_played - f.n
    from (
      select player_id, count(*) as n,
             (array_agg(rating_before order by id))[1] as first_before
        from rating_history where tournament_id = p_tournament group by player_id
    ) f
   where pl.id = f.player_id;

  delete from rating_history where tournament_id = p_tournament;
  update matches set rated = false where tournament_id = p_tournament;
  update tournaments set status = 'knockout' where id = p_tournament;
end $$;

revoke all on function public.apply_tournament_ratings(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reopen_tournament(uuid) from public, anon, authenticated;
grant execute on function public.apply_tournament_ratings(uuid, jsonb) to service_role;
grant execute on function public.reopen_tournament(uuid) to service_role;
