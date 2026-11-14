-- ── Sfide singole (fuori torneo) tra giocatori della stessa lega ──────────
-- Lato «a» = chi lancia la sfida, lato «b» = lo sfidato. Valgono per la classifica solo se la lega
-- le ha attivate e il risultato è confermato dall'avversario (o dall'amministratore).
create table challenges (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references championships(id) on delete cascade,
  challenger_id uuid not null references players(id) on delete cascade,
  opponent_id uuid not null references players(id) on delete cascade,
  best_of int not null default 3 check (best_of in (1, 3, 5, 7)),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'reported', 'confirmed', 'disputed')),
  sets_a int, sets_b int, set_scores jsonb,
  reported_by uuid references players(id) on delete set null,
  played_at timestamptz,
  confirmed_at timestamptz,
  ranked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index challenges_league_idx on challenges (championship_id, status);
create index challenges_challenger_idx on challenges (challenger_id);
create index challenges_opponent_idx on challenges (opponent_id);
-- Lettura e scrittura solo dal server (che controlla chi gioca e chi gestisce la lega).
alter table challenges enable row level security;
revoke all on challenges from anon, authenticated;

-- Storico dei punti: le sfide hanno una riga propria.
alter table rating_history add column challenge_id uuid references challenges(id) on delete cascade;
alter table rating_history drop constraint rating_history_kind_check;
alter table rating_history add constraint rating_history_kind_check check (kind in ('start', 'match', 'decay', 'challenge'));

-- Ricalcolo della classifica: come prima, più l'identificativo della sfida nello storico.
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
revoke all on function public.replace_championship_ratings(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_championship_ratings(uuid, jsonb) to service_role;

-- Pulizia permessi: nessun utente del sito deve poter svuotare tabelle o crearci trigger.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger on public.%I from anon, authenticated', t);
  end loop;
end $$;
