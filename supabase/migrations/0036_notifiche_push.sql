-- Notifiche push sul telefono (app installata) e sul computer.
-- Ogni dispositivo che le attiva lascia un «indirizzo» (endpoint + chiavi del browser), legato all'account.
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  locale text not null default 'it' check (locale in ('it', 'en')),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
-- Si scrivono solo dal server; ognuno può vedere i propri dispositivi.
create policy "push self read" on public.push_subscriptions for select using (user_id = auth.uid());

-- Chiavi del sito per firmare le notifiche (VAPID): le crea il server al primo uso e restano qui,
-- in uno schema non esposto, leggibili solo dal server tramite le due funzioni sotto.
create table private.push_keys (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
revoke all on private.push_keys from public, anon, authenticated;

create or replace function public.push_keys_get()
returns table (public_key text, private_key text) language sql stable security definer set search_path = '' as $$
  select k.public_key, k.private_key from private.push_keys k where k.id = 1;
$$;
create or replace function public.push_keys_init(p_public text, p_private text)
returns void language sql security definer set search_path = '' as $$
  insert into private.push_keys (id, public_key, private_key) values (1, p_public, p_private) on conflict (id) do nothing;
$$;
revoke all on function public.push_keys_get() from public, anon, authenticated;
revoke all on function public.push_keys_init(text, text) from public, anon, authenticated;
grant execute on function public.push_keys_get() to service_role;
grant execute on function public.push_keys_init(text, text) to service_role;
