-- Avvisi dell'amministratore, a senso unico (nessuno risponde): a tutto un circuito oppure
-- agli iscritti di un torneo. Si scrivono e si cancellano solo dal server, dopo i controlli
-- su chi gestisce il circuito o il torneo; si leggono nelle pagine del circuito e del torneo.
create table public.announcements (
  id bigint generated always as identity primary key,
  championship_id uuid references public.championships(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint announcements_one_target check ((championship_id is null) <> (tournament_id is null))
);
create index announcements_championship_idx on public.announcements (championship_id, created_at desc) where championship_id is not null;
create index announcements_tournament_idx on public.announcements (tournament_id, created_at desc) where tournament_id is not null;

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon, authenticated;
-- Avvisi del circuito: li legge chi può vedere il circuito. Quelli dei tornei passano solo dal server
-- (la pagina del torneo è aperta a chi ha il codice).
create policy "announcements circuit read" on public.announcements for select
  using (championship_id is not null and private.can_see_championship(championship_id));
