-- Formato del torneo completamente configurabile (set per fase, qualificati, ingresso nel tabellone).
-- Il formato è salvato come JSON validato dall'app (vedi src/lib/domain/format.ts).
alter table tournaments add column format jsonb;

-- Sono ammessi anche tornei a 1 solo set.
alter table tournaments drop constraint tournaments_best_of_check;
alter table tournaments add constraint tournaments_best_of_check check (best_of in (1, 3, 5, 7));
alter table tournaments alter column best_of set default 3;

-- Ogni partita conserva i propri set (best of) e il turno: la validazione dei punteggi
-- usa questi valori, quindi cambiare la configurazione non altera le partite già create.
alter table matches add column best_of int not null default 3 check (best_of in (1, 3, 5, 7));
-- Turno del tabellone contato dalla finale (0 = finale, 1 = semifinali, 2 = quarti, ...). Null per i gironi.
alter table matches add column stage int check (stage is null or stage >= 0);
