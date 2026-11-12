-- Account dei giocatori: ognuno si registra da solo e ha la sua scheda giocatore.
alter table players add column user_id uuid unique references auth.users(id) on delete set null;
-- L'id dell'account non è pubblico.
revoke select on players from anon, authenticated;
grant select (id, full_name, club, active, created_at) on players to anon, authenticated;

-- Link d'invito di un campionato (uno per campionato, rigenerabile). Lo vede solo chi gestisce il campionato.
create table championship_invites (
  championship_id uuid primary key references championships(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default now()
);
alter table championship_invites enable row level security;
create policy "manager read" on championship_invites for select using (private.can_manage(championship_id));
revoke all on championship_invites from anon;
revoke insert, update, delete on championship_invites from authenticated;

-- Richieste di partecipazione. Le scritture passano solo dal server (dopo i controlli).
create table championship_requests (
  id bigint generated always as identity primary key,
  championship_id uuid not null references championships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_player_id uuid references players(id) on delete set null,
  via_invite boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index championship_requests_one_pending on championship_requests (championship_id, user_id) where status = 'pending';
alter table championship_requests enable row level security;
create policy "self or manager read" on championship_requests for select
  using (user_id = auth.uid() or private.can_manage(championship_id));
revoke all on championship_requests from anon;
revoke insert, update, delete on championship_requests from authenticated;
