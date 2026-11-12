-- Foto profilo: il file sta nello storage "avatars" (lettura pubblica tramite indirizzo,
-- nessun elenco dei file); lo carica solo il server dopo aver verificato chi è collegato.
alter table players add column avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{8,40}\.webp$');
grant select (avatar_path) on players to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/webp'];

create or replace view championship_ranking with (security_invoker = true) as
  select cp.championship_id, p.id as player_id, p.full_name, p.club, cp.rating, cp.games_played,
         rank() over (partition by cp.championship_id order by cp.rating desc) as position,
         p.avatar_path
    from championship_players cp join players p on p.id = cp.player_id
   where p.active;
revoke all on championship_ranking from anon, authenticated;
grant select on championship_ranking to anon, authenticated;

-- Safari a volte non crea WebP: si accetta anche JPEG.
alter table players drop constraint players_avatar_path_check;
alter table players add constraint players_avatar_path_check check (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{8,40}\.(webp|jpg)$');
update storage.buckets set allowed_mime_types = array['image/webp', 'image/jpeg'] where id = 'avatars';
