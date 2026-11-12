-- ── Risultati inseriti dai giocatori ───────────────────────────────────────
-- Per torneo: anche i giocatori di una partita possono inserirne il risultato.
-- I tornei già esistenti restano come prima (solo organizzatore); i nuovi lo hanno attivo.
alter table tournaments add column player_results boolean not null default false;
alter table tournaments alter column player_results set default true;
grant insert (player_results), update (player_results) on tournaments to authenticated;

create or replace view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format, championship_id, closed_at,
         ranked, kind, registration_open, registration_deadline, player_results
    from tournaments;
revoke all on tournaments_public from anon, authenticated;
grant select on tournaments_public to anon, authenticated;

-- Chi ha inserito il risultato (giocatore; vuoto = organizzatore) e l'eventuale contestazione.
-- Scritture solo dal server (le modifiche alle partite sono già vietate agli utenti).
alter table matches add column reported_by uuid references players(id) on delete set null;
alter table matches add column disputed_by uuid references players(id) on delete set null;
alter table matches add column disputed_at timestamptz;
create index matches_disputed_idx on matches (tournament_id) where disputed_at is not null;
