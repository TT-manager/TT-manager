-- Avvisi «in evidenza»: restano in cima alla pagina del circuito o del torneo finché l'amministratore
-- non li toglie (gli altri spariscono dopo 7 giorni e ognuno può nasconderli per sé).
alter table public.announcements add column if not exists pinned boolean not null default false;
