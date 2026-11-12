-- Un campionato pubblico compare nella home di tutti; gli altri solo a chi ne fa parte
-- (la pagina resta raggiungibile con il link, per esempio da un invito).
alter table championships add column is_public boolean not null default false;
grant update (is_public) on championships to authenticated;
