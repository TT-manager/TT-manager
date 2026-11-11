-- Partite del tabellone create in anticipo: da dove arrivano i due giocatori.
-- Esempi: {"kind":"group","group":1,"position":1} oppure {"kind":"winner","stage":3,"match":0}
alter table matches add column source_a jsonb;
alter table matches add column source_b jsonb;
-- Una sola partita per posizione nel tabellone.
create unique index matches_knockout_slot on matches (tournament_id, stage, position) where phase = 'knockout';
