-- La pagina pubblica del torneo deve conoscere il formato (set, qualificati).
-- La vista continua a NON esporre organizer_code_hash.
create or replace view public.tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format
  from public.tournaments;
revoke all on public.tournaments_public from anon, authenticated;
grant select on public.tournaments_public to anon, authenticated;
