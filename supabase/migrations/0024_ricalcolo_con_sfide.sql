-- Il ricalcolo della classifica registra anche le sfide (colonna challenge_id dello storico).
create or replace function public.replace_championship_ratings(p_championship uuid, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_close uuid := nullif(p_payload->>'close', '')::uuid;
  v_reopen uuid := nullif(p_payload->>'reopen', '')::uuid;
  v_ids uuid[] := array(select (x->>'id')::uuid from jsonb_array_elements(p_payload->'matches') x);
  v_ok int;
begin
  perform pg_advisory_xact_lock(hashtextextended('tt_ratings:' || p_championship::text, 0));
  perform 1 from championships where id = p_championship for update;
  if not found then raise exception 'CAMPIONATO_NON_TROVATO'; end if;
  perform 1 from tournaments where championship_id = p_championship for update;
  if v_close is not null and not exists (select 1 from tournaments where id = v_close and championship_id = p_championship and ranked and status in ('groups', 'knockout')) then
    raise exception 'TORNEO_NON_CHIUDIBILE';
  end if;
  if v_reopen is not null and not exists (select 1 from tournaments where id = v_reopen and championship_id = p_championship and ranked and status = 'closed') then
    raise exception 'TORNEO_NON_CHIUSO';
  end if;
  drop table if exists tt_counted;
  create temp table tt_counted on commit drop as
    select id from tournaments
     where championship_id = p_championship and ranked
       and ((status = 'closed' and id is distinct from v_reopen) or id = v_close);
  perform 1 from matches where tournament_id in (select id from tt_counted) for update;
  select count(*) into v_ok
    from matches m join jsonb_array_elements(p_payload->'matches') x on m.id = (x->>'id')::uuid
   where m.tournament_id in (select id from tt_counted)
     and m.sets_a = (x->>'sets_a')::int and m.sets_b = (x->>'sets_b')::int
     and m.player_a = (x->>'player_a')::uuid and m.player_b = (x->>'player_b')::uuid;
  if v_ok <> coalesce(array_length(v_ids, 1), 0) then raise exception 'PARTITE_CAMBIATE'; end if;
  if exists (select 1 from matches where tournament_id in (select id from tt_counted)
             and sets_a is not null and not (id = any(v_ids))) then
    raise exception 'PARTITE_CAMBIATE';
  end if;
  update championship_players cp
     set rating = (x->>'rating')::int, games_played = (x->>'games')::int
    from jsonb_array_elements(p_payload->'players') x
   where cp.championship_id = p_championship and cp.player_id = (x->>'id')::uuid;
  delete from rating_history where championship_id = p_championship;
  insert into rating_history (championship_id, player_id, tournament_id, match_id, challenge_id, kind, rating_before, rating_after)
  select p_championship, (h->>'playerId')::uuid, nullif(h->>'tournamentId', '')::uuid, nullif(h->>'matchId', '')::uuid,
         nullif(h->>'challengeId', '')::uuid, h->>'kind', (h->>'before')::int, (h->>'after')::int
    from jsonb_array_elements(p_payload->'history') with ordinality as t(h, n) order by n;
  update matches set rated = (id = any(v_ids))
   where tournament_id in (select id from tournaments where championship_id = p_championship and ranked);
  if v_close is not null then
    update tournaments set status = 'closed', closed_at = now() where id = v_close;
  end if;
  if v_reopen is not null then
    update tournaments set closed_at = null, status = case
        when exists (select 1 from matches where tournament_id = v_reopen and phase = 'group' and sets_a is null)
          or not exists (select 1 from matches where tournament_id = v_reopen and phase = 'knockout')
        then 'groups' else 'knockout' end
     where id = v_reopen;
  end if;
end $$;
