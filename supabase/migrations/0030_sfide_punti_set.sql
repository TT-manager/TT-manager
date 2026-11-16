-- Punti per vincere un set nelle sfide fuori torneo (11, 21 o un valore scelto).
alter table challenges add column set_points int not null default 11 check (set_points between 3 and 50);
