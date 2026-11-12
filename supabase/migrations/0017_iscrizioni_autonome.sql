-- Iscrizione autonoma dei giocatori: l'admin apre le iscrizioni, con scadenza facoltativa.
alter table tournaments add column registration_open boolean not null default false;
alter table tournaments add column registration_deadline timestamptz;
grant update (registration_open, registration_deadline) on tournaments to authenticated;

create or replace view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format, championship_id, closed_at,
         ranked, kind, registration_open, registration_deadline
    from tournaments;
revoke all on tournaments_public from anon, authenticated;
grant select on tournaments_public to anon, authenticated;
