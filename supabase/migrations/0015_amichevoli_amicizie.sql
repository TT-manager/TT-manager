-- ── Tornei amichevoli ─────────────────────────────────────────────────────
-- Un torneo può essere: del campionato e valido per la classifica (ranked),
-- del campionato ma amichevole, oppure amichevole creato da un utente (senza campionato).
alter table tournaments alter column championship_id drop not null;
alter table tournaments add column owner_user_id uuid references auth.users(id) on delete cascade;
alter table tournaments add column ranked boolean not null default true;
alter table tournaments add column kind text;
update tournaments t set kind = c.kind from championships c where c.id = t.championship_id;
alter table tournaments alter column kind set not null;
alter table tournaments add constraint tournaments_kind_check check (kind in ('singles', 'doubles'));
alter table tournaments add constraint tournaments_friendly_check
  check (championship_id is not null or (owner_user_id is not null and not ranked));
create index tournaments_owner_idx on tournaments (owner_user_id) where owner_user_id is not null;
-- ranked, kind, owner e campionato non si cambiano dopo la creazione (nessun permesso di modifica).
grant insert (owner_user_id, ranked, kind) on tournaments to authenticated;

-- Chi crea un amichevole lo gestisce; il proprietario gestisce tutto.
create or replace function private.can_manage_tournament(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournaments t
                  where t.id = tid and (private.can_manage(t.championship_id) or t.owner_user_id = auth.uid()));
$$;
create policy "owner friendly" on tournaments for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and championship_id is null and not ranked);

-- Ospiti: giocatori senza account aggiunti da un utente ai suoi amichevoli.
alter table players add column guest_of uuid references auth.users(id) on delete set null;

create or replace view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format, championship_id, closed_at,
         ranked, kind
    from tournaments;
revoke all on tournaments_public from anon, authenticated;
grant select on tournaments_public to anon, authenticated;

-- La classifica conta solo i tornei validi (ranked).
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
  insert into rating_history (championship_id, player_id, tournament_id, match_id, kind, rating_before, rating_after)
  select p_championship, (h->>'playerId')::uuid, nullif(h->>'tournamentId', '')::uuid, nullif(h->>'matchId', '')::uuid,
         h->>'kind', (h->>'before')::int, (h->>'after')::int
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

-- ── Amicizie ──────────────────────────────────────────────────────────────
-- Una riga per coppia di utenti (user_a < user_b). Scritture solo dal server.
create table friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_b_idx on friendships (user_b);
alter table friendships enable row level security;
create policy "self read" on friendships for select using (auth.uid() in (user_a, user_b));
revoke all on friendships from anon;
revoke insert, update, delete on friendships from authenticated;
