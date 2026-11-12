-- Se il tipo non è indicato, un torneo di campionato prende il tipo del campionato.
create or replace function private.fill_tournament_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind is null and new.championship_id is not null then
    select c.kind into new.kind from public.championships c where c.id = new.championship_id;
  end if;
  return new;
end $$;
revoke all on function private.fill_tournament_kind() from public, anon, authenticated;
create trigger fill_tournament_kind before insert on public.tournaments
  for each row execute function private.fill_tournament_kind();
