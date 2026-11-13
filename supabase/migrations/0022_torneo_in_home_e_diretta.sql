-- Torneo mostrato nella home di tutti mentre è in corso (anche se la lega è privata)
-- e link alla diretta streaming (solo indirizzi https).
alter table tournaments add column featured boolean not null default false;
alter table tournaments add column stream_url text
  check (stream_url is null or (stream_url ~ '^https://[^\s<>"]+$' and char_length(stream_url) <= 300));
grant insert (featured, stream_url), update (featured, stream_url) on tournaments to authenticated;

create or replace view tournaments_public as
  select id, name, starts_on, status, public_code, best_of, group_count, created_at, format, championship_id, closed_at,
         ranked, kind, registration_open, registration_deadline, player_results, featured, stream_url
    from tournaments;
revoke all on tournaments_public from anon, authenticated;
grant select on tournaments_public to anon, authenticated;
