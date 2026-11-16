-- Sfide nei circuiti di doppio: coppia contro coppia, fuori torneo.
-- Lato «a» = chi lancia la sfida e il suo compagno, lato «b» = la coppia sfidata.
-- Nei circuiti di singolare i compagni restano vuoti.
alter table challenges add column challenger_partner_id uuid references players(id) on delete cascade;
alter table challenges add column opponent_partner_id uuid references players(id) on delete cascade;
alter table challenges add constraint challenges_partners_check check (
  (challenger_partner_id is null) = (opponent_partner_id is null)
  and (challenger_partner_id is null or (
    challenger_partner_id not in (challenger_id, opponent_id)
    and opponent_partner_id not in (challenger_id, opponent_id, challenger_partner_id)))
);
create index challenges_challenger_partner_idx on challenges (challenger_partner_id);
create index challenges_opponent_partner_idx on challenges (opponent_partner_id);
