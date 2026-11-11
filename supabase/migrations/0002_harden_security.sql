-- Hardening di sicurezza (riproduce la migrazione "harden_security" già applicata al database).

-- 1) La classifica rispetta i permessi (RLS) di chi la interroga.
alter view public.ranking set (security_invoker = true);

-- 2) La funzione is_admin vive nello schema "private" (non esposto via API).
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3) Policy ricreate usando private.is_admin().
drop policy if exists "tournaments admin read" on tournaments;
drop policy if exists "players admin write" on players;
drop policy if exists "tournaments admin write" on tournaments;
drop policy if exists "tp admin write" on tournament_players;
drop policy if exists "matches admin write" on matches;
drop policy if exists "history admin write" on rating_history;

create policy "players admin write" on players for all
  using (private.is_admin()) with check (private.is_admin());
create policy "tournaments admin write" on tournaments for all
  using (private.is_admin()) with check (private.is_admin());
create policy "tp admin write" on tournament_players for all
  using (private.is_admin()) with check (private.is_admin());
create policy "matches admin write" on matches for all
  using (private.is_admin()) with check (private.is_admin());
create policy "history admin write" on rating_history for all
  using (private.is_admin()) with check (private.is_admin());

-- 4) Eliminata la vecchia funzione pubblica.
drop function if exists public.is_admin();
