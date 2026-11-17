-- Fusione di due schede della stessa persona (doppione): tutto ciò che era della scheda
-- «from» (tornei, sfide, circuiti, albo d'oro, assenze, account) passa alla scheda «to»,
-- poi «from» sparisce. Le classifiche vanno ricalcolate dopo, dal server.
-- Rifiuta solo se le due schede risultano due persone diverse: entrambe con un account,
-- iscritte allo stesso torneo, o nella stessa sfida.
create or replace function public.merge_players(p_to uuid, p_from uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare t players%rowtype; f players%rowtype; leagues uuid[];
begin
  if p_to = p_from then raise exception 'STESSA_SCHEDA'; end if;
  select * into t from players where id = p_to for update;
  select * into f from players where id = p_from for update;
  if t.id is null or f.id is null then raise exception 'SCHEDA_NON_TROVATA'; end if;
  if t.user_id is not null and f.user_id is not null then raise exception 'DUE_ACCOUNT'; end if;
  if exists (select 1 from entry_members a join entry_members b using (tournament_id)
             where a.player_id = p_to and b.player_id = p_from) then raise exception 'STESSO_TORNEO'; end if;
  if exists (select 1 from challenges where p_to in (challenger_id, opponent_id, challenger_partner_id, opponent_partner_id)
                                        and p_from in (challenger_id, opponent_id, challenger_partner_id, opponent_partner_id))
    then raise exception 'STESSA_SFIDA'; end if;

  update entry_members set player_id = p_to where player_id = p_from;
  update matches set reported_by = p_to where reported_by = p_from;
  update matches set disputed_by = p_to where disputed_by = p_from;
  update challenges set challenger_id = p_to where challenger_id = p_from;
  update challenges set opponent_id = p_to where opponent_id = p_from;
  update challenges set challenger_partner_id = p_to where challenger_partner_id = p_from;
  update challenges set opponent_partner_id = p_to where opponent_partner_id = p_from;
  update challenges set reported_by = p_to where reported_by = p_from;
  update challenges set cancelled_by = p_to where cancelled_by = p_from;
  insert into championship_players (championship_id, player_id, start_override, joined_on)
    select championship_id, p_to, start_override, joined_on from championship_players where player_id = p_from
    on conflict (championship_id, player_id) do nothing;
  insert into past_results (past_tournament_id, player_id, position)
    select past_tournament_id, p_to, position from past_results where player_id = p_from
    on conflict (past_tournament_id, player_id) do nothing;
  update player_absences set player_id = p_to where player_id = p_from;
  update championship_requests set claim_player_id = null where claim_player_id = p_from;

  -- L'account (se c'è) può stare su una sola scheda: prima si libera «from».
  update players set user_id = null where id = p_from;
  update players set
    user_id = coalesce(t.user_id, f.user_id),
    avatar_path = coalesce(t.avatar_path, f.avatar_path),
    club_id = coalesce(t.club_id, f.club_id),
    active = t.active or f.active,
    guest_of = case when t.guest_of is not null and f.guest_of is not null then t.guest_of else null end
  where id = p_to;
  delete from players where id = p_from;

  select coalesce(array_agg(championship_id), '{}') into leagues from championship_players where player_id = p_to;
  return leagues;
end $$;
revoke all on function public.merge_players(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_players(uuid, uuid) to service_role;

-- Schede dei giocatori: le crea qualunque amministratore (dal suo circuito); le corregge il proprietario
-- o l'amministratore di un circuito di cui il giocatore fa parte; le elimina solo il proprietario.
-- Attivare o disattivare un giocatore vale per tutti i circuiti: solo il proprietario.
create or replace function private.can_manage_player(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championship_players cp
                   join public.championship_admins ca on ca.championship_id = cp.championship_id
                   join public.admins a on a.user_id = ca.user_id
                  where cp.player_id = pid and ca.user_id = auth.uid());
$$;
revoke all on function private.can_manage_player(uuid) from public;
grant execute on function private.can_manage_player(uuid) to authenticated;

drop policy if exists "players admin write" on public.players;
create policy "players admin insert" on public.players for insert with check (private.is_admin());
create policy "players admin update" on public.players for update
  using (private.is_owner() or private.can_manage_player(id)) with check (private.is_owner() or private.can_manage_player(id));
create policy "players owner delete" on public.players for delete using (private.is_owner());

create or replace function private.guard_player_active()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and new.active is distinct from old.active and not private.is_owner() then
    raise exception 'SOLO_PROPRIETARIO';
  end if;
  return new;
end $$;
drop trigger if exists guard_player_active on public.players;
create trigger guard_player_active before update on public.players for each row execute function private.guard_player_active();
