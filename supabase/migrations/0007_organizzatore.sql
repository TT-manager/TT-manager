-- Accesso "organizzatore torneo" (senza account). Tabelle usate SOLO dal server
-- con la chiave service_role: nessun accesso dal browser (RLS senza permessi).

-- Sessione dopo un codice corretto: il cookie contiene un token casuale,
-- qui se ne salva solo l'hash SHA-256.
create table organizer_sessions (
  token_hash text primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on organizer_sessions (tournament_id);

-- Tentativi di codice falliti, per limitare chi prova a indovinare.
-- L'indirizzo IP è salvato solo come hash.
create table organizer_attempts (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index on organizer_attempts (tournament_id, created_at);

alter table organizer_sessions enable row level security;
alter table organizer_attempts enable row level security;
-- Nessun accesso per anon/authenticated (la service_role ignora la RLS).
create policy "no access" on organizer_sessions for all to anon, authenticated using (false) with check (false);
create policy "no access" on organizer_attempts for all to anon, authenticated using (false) with check (false);
revoke all on organizer_sessions, organizer_attempts from anon, authenticated;
