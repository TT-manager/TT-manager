-- Avvisi nell'app (campanella) e preferenze email.
-- Gli avvisi li scrive solo il server (chiave segreta); ognuno legge i propri.
create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}',
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "self read" on notifications for select using (user_id = auth.uid());

-- Email per i nuovi tornei: attive di base; il codice serve al link «non ricevere più» senza accesso.
create table notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_tournaments boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique
);
alter table notification_prefs enable row level security;
create policy "self read" on notification_prefs for select using (user_id = auth.uid());

-- Un torneo si annuncia una volta sola (alla prima apertura delle iscrizioni).
alter table tournaments add column announced_at timestamptz;
