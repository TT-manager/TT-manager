-- Archivio privato per le copie notturne del database (scritto e letto solo dal server con la chiave segreta:
-- nessuna policy di accesso per gli utenti).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/json'])
on conflict (id) do nothing;
