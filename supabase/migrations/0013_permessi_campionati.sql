-- Gli admin possono cambiare solo nome e regole del campionato (non tipo, indirizzo, autore).
revoke update on championships from anon, authenticated;
grant update (name, settings) on championships to authenticated;

-- Tornei: non si spostano tra campionati e la chiusura passa solo dal server (ricalcolo classifica).
revoke update on tournaments from anon, authenticated;
grant update (name, starts_on, format, best_of, group_count, status, organizer_code_hash, public_code) on tournaments to authenticated;

create or replace function private.guard_tournament_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and (new.status <> 'draft' or new.closed_at is not null) then
      raise exception 'TORNEO_NUOVO_NON_BOZZA';
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status and 'closed' in (new.status, old.status) then
      raise exception 'CHIUSURA_SOLO_DAL_SERVER';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_tournament_status() from public, anon, authenticated;

drop trigger if exists guard_tournament_status on public.tournaments;
create trigger guard_tournament_status before insert or update on public.tournaments
  for each row execute function private.guard_tournament_status();
