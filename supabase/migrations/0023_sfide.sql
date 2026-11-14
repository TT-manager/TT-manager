-- ── Sfide singole (fuori torneo) tra giocatori della stessa lega ─────────────
-- Lato «a» = chi lancia la sfida, lato «b» = lo sfidato. Valgono per la classifica solo se la lega
-- le ha attivate (championships.settings.challenges) e il risultato è confermato dall'avversario
-- (o da un amministratore). Lettura e scrittura solo dal server, con la chiave segreta:
-- RLS attivo e nessuna policy.
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
  -- Vale per la classifica (deciso alla conferma: sfide attive e limite settimanale rispettato).
  ranked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index challenges_league_idx on challenges (championship_id, status);
create index challenges_challenger_idx on challenges (challenger_id);
create index challenges_opponent_idx on challenges (opponent_id);
alter table challenges enable row level security;

-- Storico dei punti: le partite delle sfide hanno kind 'match' e challenge_id valorizzato.
alter table rating_history add column challenge_id uuid references challenges(id) on delete cascade;

-- Il ricalcolo (replace_championship_ratings) che scrive challenge_id è nella 0024.
