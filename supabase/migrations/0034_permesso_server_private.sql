-- Il controllo guard_player_active (0031) usa private.is_owner(): il server (service_role) non aveva
-- accesso allo schema private, quindi ogni sua modifica a una scheda giocatore veniva rifiutata
-- (cambio nome/circolo dal profilo, collegamento della scheda, modalità solo amministratore).
-- Il server ha già pieni poteri sui dati: gli si dà solo l'accesso allo schema.
grant usage on schema private to service_role;
