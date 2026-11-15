-- Storico dei punti: nuovo tipo «placement» per il premio di piazzamento dei tornei
-- (primi 4, in proporzione al numero di partecipanti).
alter table rating_history drop constraint rating_history_kind_check;
alter table rating_history add constraint rating_history_kind_check check (kind in ('start', 'match', 'decay', 'placement'));
