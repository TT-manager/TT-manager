-- Ogni partita ricorda i punti per vincere un set e l'eventuale golden point:
-- la validazione dei punteggi usa questi valori, quindi cambiare il formato
-- non altera le partite già create.
alter table matches add column set_points int not null default 11 check (set_points between 3 and 50);
alter table matches add column golden_point int check (golden_point is null or (golden_point >= set_points - 1 and golden_point <= 60));
