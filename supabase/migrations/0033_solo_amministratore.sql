-- Modalità «solo amministratore»: chi gestisce i circuiti senza giocare. La sua scheda giocatore
-- non viene cancellata ma resa non attiva (sparisce da classifiche, iscrizioni e sfide; lo storico
-- resta e chi ha giocato contro di lui tiene i punti). Si attiva e disattiva dal server.
alter table public.admins add column if not exists admin_only boolean not null default false;
