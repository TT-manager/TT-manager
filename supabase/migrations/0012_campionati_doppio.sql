-- Campionati multipli (ognuno con classifica e tornei propri), admin per campionato,
-- singolare/doppio, classifica di partenza dai podi passati, assenze giustificate.
-- Il database era vuoto: ristrutturazione senza migrazione di dati.

-- ── Campionati ──────────────────────────────────────────────────────────────
create table championships (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'singles' check (kind in ('singles', 'doubles')),
  -- Impostazioni del ranking (validate dall'app: src/lib/domain/ranking.ts).
  settings jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table championship_admins (
  championship_id uuid not null references championships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (championship_id, user_id)
);

-- Giocatori di un campionato con i loro punti (calcolati dal server).
create table championship_players (
  championship_id uuid not null references championships(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  -- Correzione manuale della classifica di partenza (null = calcolata dai podi).
  start_override int check (start_override is null or start_override between 0 and 5000),
  rating int not null default 1000,
  games_played int not null default 0,
  joined_on date not null default current_date,
  primary key (championship_id, player_id)
);

-- Tornei passati, ricordati solo per il podio (classifica di partenza e albo d'oro).
create table past_tournaments (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references championships(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  held_on date,
  created_at timestamptz not null default now()
);
create table past_results (
  past_tournament_id uuid not null references past_tournaments(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  position int not null check (position between 1 and 4),
  primary key (past_tournament_id, player_id)
);

-- Assenze giustificate (infortunio...): nessun calo dei punti in quel periodo. Non pubbliche.
create table player_absences (
  id bigint generated always as identity primary key,
  championship_id uuid not null references championships(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  from_date date not null,
  to_date date,
  note text check (note is null or length(note) <= 200),
  check (to_date is null or to_date >= from_date)
);

-- ── Tornei nei campionati ───────────────────────────────────────────────────
alter table tournaments add column championship_id uuid not null references championships(id) on delete cascade;
alter table tournaments add column closed_at timestamptz;
create index on tournaments (championship_id);

-- Iscrizioni: una «voce» è un giocatore (singolare) o una coppia (doppio).
-- Nelle partite, player_a / player_b indicano la VOCE (tournament_entries.id).
drop view if exists ranking;
alter table matches drop constraint matches_player_a_fkey;
alter table matches drop constraint matches_player_b_fkey;
drop table tournament_players;

create table tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  seed int,
  group_no int
);
create index on tournament_entries (tournament_id);
create table entry_members (
  entry_id uuid not null references tournament_entries(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id uuid not null references players(id),
  -- un giocatore compare al massimo una volta per torneo
  primary key (tournament_id, player_id)
);
create index on entry_members (entry_id);

alter table matches add constraint matches_entry_a_fkey foreign key (player_a) references tournament_entries(id) on delete cascade;
alter table matches add constraint matches_entry_b_fkey foreign key (player_b) references tournament_entries(id) on delete cascade;
comment on column matches.player_a is 'Voce iscritta (tournament_entries.id): giocatore o coppia';
comment on column matches.player_b is 'Voce iscritta (tournament_entries.id): giocatore o coppia';

-- ── Storico punti per campionato ────────────────────────────────────────────
alter table rating_history add column championship_id uuid not null references championships(id) on delete cascade;
alter table rating_history add column kind text not null default 'match' check (kind in ('start', 'match', 'decay'));
alter table rating_history drop constraint rating_history_player_id_fkey;
alter table rating_history add constraint rating_history_player_id_fkey foreign key (player_id) references players(id) on delete cascade;
alter table rating_history drop constraint rating_history_tournament_id_fkey;
alter table rating_history add constraint rating_history_tournament_id_fkey foreign key (tournament_id) references tournaments(id) on delete cascade;
alter table rating_history drop constraint rating_history_match_id_fkey;
alter table rating_history add constraint rating_history_match_id_fkey foreign key (match_id) references matches(id) on delete cascade;
create index on rating_history (championship_id, player_id, id);

-- I punti vivono nei campionati, non più sul giocatore.
alter table players drop column rating;
alter table players drop column games_played;

-- ── Permessi ────────────────────────────────────────────────────────────────
create or replace function private.is_owner() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'owner');
$$;
create or replace function private.can_manage(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select private.is_owner()
      or exists (select 1 from public.championship_admins ca
                  join public.admins a on a.user_id = ca.user_id
                 where ca.championship_id = cid and ca.user_id = auth.uid());
$$;
create or replace function private.can_manage_tournament(tid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select private.can_manage((select championship_id from public.tournaments where id = tid));
$$;

alter table championships enable row level security;
alter table championship_admins enable row level security;
alter table championship_players enable row level security;
alter table past_tournaments enable row level security;
alter table past_results enable row level security;
alter table player_absences enable row level security;
alter table tournament_entries enable row level security;
alter table entry_members enable row level security;

create policy "read" on championships for select using (true);
create policy "owner insert" on championships for insert with check (private.is_owner());
create policy "owner delete" on championships for delete using (private.is_owner());
create policy "manager update" on championships for update using (private.can_manage(id)) with check (private.can_manage(id));

create policy "owner or self read" on championship_admins for select using (private.is_owner() or user_id = auth.uid());
create policy "owner write" on championship_admins for all using (private.is_owner()) with check (private.is_owner());

create policy "read" on championship_players for select using (true);
create policy "manager write" on championship_players for all using (private.can_manage(championship_id)) with check (private.can_manage(championship_id));

create policy "read" on past_tournaments for select using (true);
create policy "manager write" on past_tournaments for all using (private.can_manage(championship_id)) with check (private.can_manage(championship_id));
create policy "read" on past_results for select using (true);
create policy "manager write" on past_results for all
  using (private.can_manage((select championship_id from past_tournaments where id = past_tournament_id)))
  with check (private.can_manage((select championship_id from past_tournaments where id = past_tournament_id)));

create policy "manager read" on player_absences for select using (private.can_manage(championship_id));
create policy "manager write" on player_absences for all using (private.can_manage(championship_id)) with check (private.can_manage(championship_id));

create policy "read" on tournament_entries for select using (true);
create policy "manager write" on tournament_entries for all using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));
create policy "read" on entry_members for select using (true);
create policy "manager write" on entry_members for all using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

-- Tornei e partite: dal globale «admin» al campionato.
drop policy if exists "tournaments admin write" on tournaments;
create policy "manager all" on tournaments for all using (private.can_manage(championship_id)) with check (private.can_manage(championship_id));
drop policy if exists "matches admin write" on matches;
create policy "manager write" on matches for all using (private.can_manage_tournament(tournament_id)) with check (private.can_manage_tournament(tournament_id));

-- Punti, partite giocate, partite conteggiate e storico: solo dal server (chiave segreta).
revoke insert, update on championship_players from anon, authenticated;
grant insert (championship_id, player_id, start_override, joined_on) on championship_players to authenticated;
grant update (start_override, joined_on) on championship_players to authenticated;
revoke update on matches from anon, authenticated;
revoke insert, update, delete on rating_history from anon, authenticated;
revoke all on player_absences from anon;

-- ── Viste pubbliche ─────────────────────────────────────────────────────────
create view championship_ranking with (security_invoker = true) as
  select cp.championship_id, p.id as player_id, p.full_name, p.club, cp.rating, cp.games_played,
         rank() over (partition by cp.championship_id order by cp.rating desc) as position
    from championship_players cp join players p on p.id = cp.player_id
   where p.active;
revoke all on championship_ranking from anon, authenticated;
grant select on championship_ranking to anon, authenticated;

create or replace view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format, championship_id, closed_at
    from tournaments;
revoke all on tournaments_public from anon, authenticated;
grant select on tournaments_public to anon, authenticated;

-- ── Ricalcolo della classifica (scritto dal server) ─────────────────────────
-- Il server ricalcola tutta la classifica del campionato e la scrive qui in un'unica
-- transazione. Verifica che i risultati usati siano identici a quelli nel database.
-- Opzionalmente chiude o riapre un torneo nella stessa transazione.
drop function if exists public.apply_tournament_ratings(uuid, jsonb);
drop function if exists public.reopen_tournament(uuid);

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

  if v_close is not null and not exists (select 1 from tournaments where id = v_close and championship_id = p_championship and status in ('groups', 'knockout')) then
    raise exception 'TORNEO_NON_CHIUDIBILE';
  end if;
  if v_reopen is not null and not exists (select 1 from tournaments where id = v_reopen and championship_id = p_championship and status = 'closed') then
    raise exception 'TORNEO_NON_CHIUSO';
  end if;

  -- I tornei conteggiati dopo questa operazione.
  drop table if exists tt_counted;
  create temp table tt_counted on commit drop as
    select id from tournaments
     where championship_id = p_championship
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
  insert into rating_history (championship_id, player_id, tournament_id, match_id, kind, rating_before, rating_after)
  select p_championship, (h->>'playerId')::uuid, nullif(h->>'tournamentId', '')::uuid, nullif(h->>'matchId', '')::uuid,
         h->>'kind', (h->>'before')::int, (h->>'after')::int
    from jsonb_array_elements(p_payload->'history') with ordinality as t(h, n) order by n;

  update matches set rated = (id = any(v_ids))
   where tournament_id in (select id from tournaments where championship_id = p_championship);

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
