-- Correzioni dalla revisione di sicurezza.

-- 1) Tentativi del codice organizzatore registrati in modo atomico PRIMA della verifica
--    (niente scorciatoie con richieste parallele). Restituisce l'id del tentativo,
--    oppure null se il limite per indirizzo è stato raggiunto.
create or replace function public.organizer_attempt_begin(p_tournament uuid, p_ip text, p_max int, p_window_min int)
returns bigint language plpgsql security invoker set search_path = public as $$
declare n int; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tournament::text || ':' || p_ip, 0));
  -- Pulizia: tentativi vecchi e sessioni scadute.
  delete from organizer_attempts where created_at < now() - interval '1 day';
  delete from organizer_sessions where expires_at < now();
  select count(*) into n from organizer_attempts
   where tournament_id = p_tournament and ip_hash = p_ip
     and created_at > now() - make_interval(mins => p_window_min);
  if n >= p_max then return null; end if;
  insert into organizer_attempts (tournament_id, ip_hash) values (p_tournament, p_ip) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.organizer_attempt_begin(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.organizer_attempt_begin(uuid, text, int, int) to service_role;

-- 2) Nessuna modifica ai risultati di partite già conteggiate o di tornei chiusi.
--    Il lock condiviso sul torneo mette in fila un salvataggio e una chiusura contemporanei.
create or replace function private.guard_match_result() returns trigger
language plpgsql security invoker set search_path = public as $$
declare st text;
begin
  if (new.sets_a, new.sets_b, new.set_scores, new.player_a, new.player_b)
     is not distinct from (old.sets_a, old.sets_b, old.set_scores, old.player_a, old.player_b) then
    return new;
  end if;
  select status into st from tournaments where id = new.tournament_id for share;
  if old.rated or st = 'closed' then raise exception 'PARTITA_BLOCCATA'; end if;
  return new;
end $$;
drop trigger if exists matches_guard on matches;
create trigger matches_guard before update on matches for each row execute function private.guard_match_result();

-- 3) Chiusura: lock globale sulle operazioni di rating e verifica che i risultati
--    siano identici a quelli usati per il calcolo.
create or replace function public.apply_tournament_ratings(p_tournament uuid, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_ids uuid[] := array(select (x->>'id')::uuid from jsonb_array_elements(p_payload->'matches') x);
  v_ok int;
  p jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('tt_ratings'));
  perform 1 from tournaments where id = p_tournament and status in ('groups', 'knockout') for update;
  if not found then raise exception 'TORNEO_NON_CHIUDIBILE'; end if;
  perform 1 from matches where tournament_id = p_tournament for update;
  select count(*) into v_ok
    from matches m join jsonb_array_elements(p_payload->'matches') x on m.id = (x->>'id')::uuid
   where m.tournament_id = p_tournament and m.rated = false
     and m.sets_a = (x->>'sets_a')::int and m.sets_b = (x->>'sets_b')::int
     and m.player_a = (x->>'player_a')::uuid and m.player_b = (x->>'player_b')::uuid;
  if v_ok <> coalesce(array_length(v_ids, 1), 0) then raise exception 'PARTITE_CAMBIATE'; end if;
  if exists (select 1 from matches where tournament_id = p_tournament and rated = false
             and sets_a is not null and not (id = any(v_ids))) then
    raise exception 'PARTITE_CAMBIATE';
  end if;
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

-- 4) Riapertura: lock globale, giocatori bloccati PRIMA del controllo sui tornei successivi,
--    stato ricalcolato dalle partite.
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
      then 'groups' else 'knockout' end
   where id = p_tournament;
end $$;
revoke all on function public.apply_tournament_ratings(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reopen_tournament(uuid) from public, anon, authenticated;
grant execute on function public.apply_tournament_ratings(uuid, jsonb) to service_role;
grant execute on function public.reopen_tournament(uuid) to service_role;

-- 5) Dal browser gli admin non toccano rating, partite conteggiate e storico:
--    cambiano solo con chiusura/riapertura (server, chiave segreta).
revoke update on players from anon, authenticated;
grant update (full_name, club, active) on players to authenticated;
revoke update on matches from anon, authenticated;
revoke insert, update, delete on rating_history from anon, authenticated;
drop policy if exists "history admin write" on rating_history;
