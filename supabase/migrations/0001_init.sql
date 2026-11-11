-- TT-manager: schema iniziale.
-- Modello di sicurezza:
--  * lettura pubblica di giocatori, tornei, partite e classifica
--  * scrittura admin: utenti autenticati presenti in `admins`
--  * scrittura organizzatore torneo: SOLO dal server Next.js (service role),
--    dopo aver verificato il codice organizzatore. Mai dal browser.

create extension if not exists pgcrypto;

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  club text,
  rating int not null default 1000,
  games_played int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  status text not null default 'draft'
    check (status in ('draft', 'groups', 'knockout', 'closed')),
  -- Codice pubblico per aprire la pagina del torneo (/t/CODICE).
  public_code text not null unique,
  -- Hash del codice con cui si inseriscono i risultati. Il codice in chiaro non è salvato.
  organizer_code_hash text not null,
  best_of int not null default 5 check (best_of in (3, 5, 7)),
  group_count int not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table tournament_players (
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id),
  seed int,
  group_no int,
  primary key (tournament_id, player_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  phase text not null check (phase in ('group', 'knockout')),
  group_no int,
  round int not null default 1,
  position int not null default 0,
  player_a uuid references players(id),
  player_b uuid references players(id),
  sets_a int,
  sets_b int,
  -- punteggi dei singoli set, es. [[11,7],[9,11],[11,5]]
  set_scores jsonb,
  played_at timestamptz,
  -- true quando il rating Elo è già stato applicato (evita doppi conteggi)
  rated boolean not null default false
);

create index on matches (tournament_id, phase);

-- Storico rating: alimenta classifica e grafici.
create table rating_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id),
  tournament_id uuid references tournaments(id),
  match_id uuid references matches(id),
  rating_before int not null,
  rating_after int not null,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table admins enable row level security;
alter table players enable row level security;
alter table tournaments enable row level security;
alter table tournament_players enable row level security;
alter table matches enable row level security;
alter table rating_history enable row level security;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Lettura pubblica (l'hash del codice organizzatore NON deve essere esposto: vedi vista sotto)
create policy "players read" on players for select using (true);
create policy "tp read" on tournament_players for select using (true);
create policy "matches read" on matches for select using (true);
create policy "history read" on rating_history for select using (true);
create policy "admins read self" on admins for select using (user_id = auth.uid());

-- La tabella tournaments contiene l'hash: lettura solo admin; il pubblico usa la vista.
create policy "tournaments admin read" on tournaments for select using (is_admin());

create view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at
  from tournaments;
grant select on tournaments_public to anon, authenticated;

-- Scrittura admin
create policy "players admin write" on players for all using (is_admin()) with check (is_admin());
create policy "tournaments admin write" on tournaments for all using (is_admin()) with check (is_admin());
create policy "tp admin write" on tournament_players for all using (is_admin()) with check (is_admin());
create policy "matches admin write" on matches for all using (is_admin()) with check (is_admin());
create policy "history admin write" on rating_history for all using (is_admin()) with check (is_admin());

-- Classifica generale
create view ranking as
  select id, full_name, club, rating, games_played,
         rank() over (order by rating desc) as position
  from players
  where active;
grant select on ranking to anon, authenticated;
