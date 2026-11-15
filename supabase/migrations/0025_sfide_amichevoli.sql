-- Sfide amichevoli scelte da chi lancia la sfida (non valgono mai per la classifica)
-- e chi ha annullato una sfida (per avvisare l'altro giocatore).
alter table challenges add column friendly boolean not null default false;
alter table challenges add column cancelled_by uuid references players(id) on delete set null;
