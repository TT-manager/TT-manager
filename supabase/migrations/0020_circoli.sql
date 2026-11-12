-- ── Circoli ───────────────────────────────────────────────────────────────
-- Elenco gestito dal proprietario. Il giocatore sceglie un circolo dall'elenco;
-- players.club resta come nome da mostrare ed è tenuto allineato dal database.
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  city text check (city is null or char_length(city) <= 60),
  created_at timestamptz not null default now()
);
create unique index clubs_name_unique on clubs (lower(btrim(name)));
alter table clubs enable row level security;
create policy "clubs read" on clubs for select using (true);
create policy "clubs owner write" on clubs for all using (private.is_owner()) with check (private.is_owner());
revoke all on clubs from anon;
grant select on clubs to anon;
revoke truncate, references, trigger on clubs from authenticated;

alter table players add column club_id uuid references clubs(id) on delete set null;
create index players_club_idx on players (club_id) where club_id is not null;
grant select (club_id) on players to anon, authenticated;
grant update (club_id) on players to authenticated;

-- Il nome del circolo del giocatore deriva sempre da club_id (niente testo libero).
create or replace function private.sync_player_club() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.club := (select name from public.clubs where id = new.club_id);
  return new;
end $$;
create trigger players_sync_club before insert or update of club, club_id on players
  for each row execute function private.sync_player_club();

create or replace function private.rename_club_players() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.players set club = new.name where club_id = new.id;
  return new;
end $$;
create trigger clubs_rename after update of name on clubs
  for each row execute function private.rename_club_players();

-- Richieste di nuovi circoli (scritture solo dal server; le vede chi le ha fatte e il proprietario).
create table club_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  city text check (city is null or char_length(city) <= 60),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  club_id uuid references clubs(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index club_requests_one_pending on club_requests (user_id) where status = 'pending';
alter table club_requests enable row level security;
create policy "club requests read" on club_requests for select using (user_id = auth.uid() or private.is_owner());
revoke all on club_requests from anon;
revoke insert, update, delete, truncate, references, trigger on club_requests from authenticated;

-- I nomi scritti finora diventano circoli dell'elenco (il proprietario può poi rinominarli o eliminarli).
insert into clubs (name)
  select distinct on (lower(btrim(club))) btrim(club) from players
   where club is not null and char_length(btrim(club)) between 2 and 80
  on conflict do nothing;
update players p set club_id = c.id from clubs c where lower(btrim(p.club)) = lower(btrim(c.name));
update players set club = null where club_id is null and club is not null;
