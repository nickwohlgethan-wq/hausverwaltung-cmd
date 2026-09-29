-- Hausverwaltung: Schema, Zugriffsregeln (Row-Level-Security) und Einladungsfluss.
--
-- Sicherheitsmodell
--   * Jeder Verwalter-Account ist ein eigener Arbeitsbereich: alle Zeilen tragen seine `owner_id`.
--   * Zusammengesetzte Fremdschlüssel (…, owner_id) erzwingen, dass verknüpfte Zeilen demselben
--     Verwalter gehören. Fremde IDs lassen sich also nicht einhängen.
--   * Mieter sehen ausschließlich ihre eigene Wohnung, Zahlungen, Kosten und Tickets.
--     Ein Mieter wird nur über einen einmaligen Einladungscode mit seinem Mieter-Datensatz verknüpft.
--   * Clients dürfen nur die Spalten schreiben, die unten per GRANT freigegeben sind
--     (z. B. weder `owner_id` noch `user_id`, noch die Rolle im Profil).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Profile (Rolle je Konto)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('verwalter', 'mieter')),
  display_name text not null check (btrim(display_name) <> '' and length(display_name) <= 100),
  created_at timestamptz not null default now()
);

-- Legt beim Registrieren das Profil an. Die Rolle kommt aus den Registrierungsdaten;
-- unbekannte Werte fallen auf die harmlosere Rolle „mieter“ zurück.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'mieter');
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if v_role not in ('verwalter', 'mieter') then
    v_role := 'mieter';
  end if;
  if v_name = '' then
    v_name := btrim(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  if v_name = '' then
    v_name := 'Nutzer';
  end if;
  insert into public.profiles (id, role, display_name) values (new.id, v_role, left(v_name, 100));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Fachtabellen
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> '' and length(name) <= 200),
  street text not null check (btrim(street) <> '' and length(street) <= 200),
  zip text not null check (btrim(zip) <> '' and length(zip) <= 20),
  city text not null check (btrim(city) <> '' and length(city) <= 200),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  name text not null check (btrim(name) <> '' and length(name) <= 200),
  floor text not null default '' check (length(floor) <= 100),
  area_sqm numeric(8, 2) not null check (area_sqm > 0),
  rooms numeric(4, 1) not null check (rooms > 0),
  -- Geldbeträge in Cent
  base_rent integer not null check (base_rent >= 0),
  utilities_prepayment integer not null check (utilities_prepayment >= 0),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (property_id, owner_id) references public.properties (id, owner_id)
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null,
  -- Konto des Mieters; wird nur über claim_tenant() gesetzt
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (btrim(name) <> '' and length(name) <= 200),
  email text not null default '' check (length(email) <= 320),
  phone text not null default '' check (length(phone) <= 50),
  move_in date not null,
  -- Einmaliger Einladungscode (12 Zeichen, Großbuchstaben/Ziffern); nach dem Einlösen null
  invite_code text unique check (invite_code ~ '^[0-9A-F]{12}$'),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (id, unit_id),
  -- Aktuell genau ein Mieter je Wohnung
  unique (unit_id),
  foreign key (unit_id, owner_id) references public.units (id, owner_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tenant_id uuid not null,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  rent_due integer not null check (rent_due >= 0),
  utilities_due integer not null check (utilities_due >= 0),
  paid integer not null default 0 check (paid >= 0),
  paid_on date,
  created_at timestamptz not null default now(),
  unique (tenant_id, month),
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id)
);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  year integer not null check (year between 1990 and 2100),
  category text not null check (btrim(category) <> '' and length(category) <= 100),
  amount integer not null check (amount > 0),
  key text not null check (key in ('area', 'units')),
  created_at timestamptz not null default now(),
  foreign key (property_id, owner_id) references public.properties (id, owner_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  -- wird per Trigger aus dem Mieter übernommen, nie vom Client gesetzt
  owner_id uuid not null,
  tenant_id uuid not null,
  unit_id uuid not null,
  title text not null check (btrim(title) <> '' and length(title) <= 200),
  description text not null default '' check (length(description) <= 5000),
  category text not null check (btrim(category) <> '' and length(category) <= 100),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (tenant_id, owner_id) references public.tenants (id, owner_id),
  -- Ticket-Wohnung muss die Wohnung des Mieters sein
  foreign key (tenant_id, unit_id) references public.tenants (id, unit_id)
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  ticket_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  author_role text not null check (author_role in ('verwalter', 'mieter')),
  author_name text not null,
  text text not null check (btrim(text) <> '' and length(text) <= 5000),
  created_at timestamptz not null default now(),
  foreign key (ticket_id, owner_id) references public.tickets (id, owner_id)
);

create index on public.units (owner_id);
create index on public.units (property_id);
create index on public.tenants (owner_id);
create index on public.payments (owner_id, month);
create index on public.costs (property_id, year);
create index on public.tickets (owner_id);
create index on public.tickets (tenant_id);
create index on public.ticket_comments (ticket_id);

-- Eigentümer, Autor und Rolle stammen immer aus der Datenbank, nie vom Client.
create function private.tickets_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select t.owner_id into new.owner_id from public.tenants t where t.id = new.tenant_id;
  return new;
end;
$$;

create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function private.tickets_before_insert();

create function private.comments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_name text;
begin
  select t.owner_id into new.owner_id from public.tickets t where t.id = new.ticket_id;
  select p.role, p.display_name into v_role, v_name from public.profiles p where p.id = auth.uid();
  if v_role is null then
    raise exception 'Kein Profil vorhanden' using errcode = '42501';
  end if;
  if v_role = 'mieter' then
    select t.name into v_name from public.tenants t where t.user_id = auth.uid();
  end if;
  new.author_id := auth.uid();
  new.author_role := v_role;
  new.author_name := coalesce(v_name, 'Mieter');
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.ticket_comments
  for each row execute function private.comments_before_insert();

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für die Policies (umgehen RLS, geben nur Daten des Aufrufers zurück)
-- ---------------------------------------------------------------------------

create function private.user_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create function private.my_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select t.id from public.tenants t where t.user_id = auth.uid()
$$;

create function private.my_unit_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select t.unit_id from public.tenants t where t.user_id = auth.uid()
$$;

create function private.my_property_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.property_id
  from public.tenants t
  join public.units u on u.id = t.unit_id
  where t.user_id = auth.uid()
$$;

grant execute on function
  private.user_role(), private.my_tenant_id(), private.my_unit_id(), private.my_property_id()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level-Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.payments enable row level security;
alter table public.costs enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- Verwalter: voller Zugriff (im Rahmen der GRANTs unten) auf die eigenen Zeilen
create policy properties_owner on public.properties
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy units_owner on public.units
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy tenants_owner on public.tenants
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy payments_owner on public.payments
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy costs_owner on public.costs
  for all to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy tickets_owner_select on public.tickets
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy tickets_owner_update on public.tickets
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter')
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy comments_owner_select on public.ticket_comments
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

create policy comments_owner_insert on public.ticket_comments
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.user_role()) = 'verwalter');

-- Mieter: nur lesen, und nur die eigenen Daten; Tickets und Antworten dürfen sie zusätzlich anlegen
create policy properties_tenant_select on public.properties
  for select to authenticated using (id = (select private.my_property_id()));

create policy units_tenant_select on public.units
  for select to authenticated using (id = (select private.my_unit_id()));

create policy tenants_self_select on public.tenants
  for select to authenticated using (user_id = (select auth.uid()));

create policy payments_tenant_select on public.payments
  for select to authenticated using (tenant_id = (select private.my_tenant_id()));

create policy costs_tenant_select on public.costs
  for select to authenticated using (property_id = (select private.my_property_id()));

create policy tickets_tenant_select on public.tickets
  for select to authenticated using (tenant_id = (select private.my_tenant_id()));

create policy tickets_tenant_insert on public.tickets
  for insert to authenticated
  with check (
    tenant_id = (select private.my_tenant_id())
    and unit_id = (select private.my_unit_id())
  );

create policy comments_tenant_select on public.ticket_comments
  for select to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id and t.tenant_id = (select private.my_tenant_id())
  ));

create policy comments_tenant_insert on public.ticket_comments
  for insert to authenticated
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id and t.tenant_id = (select private.my_tenant_id())
  ));

-- ---------------------------------------------------------------------------
-- Rechte: alles entziehen, dann gezielt spaltenweise vergeben
-- ---------------------------------------------------------------------------

-- Sicher als Standard: Spätere Tabellen sind für App-Nutzer zunächst gesperrt und müssen bewusst
-- freigegeben werden (Supabase gibt sie sonst automatisch an anon/authenticated).
-- Hinweis zu Funktionen: Postgres erlaubt EXECUTE standardmäßig für PUBLIC, das lässt sich schemaweit nicht
-- abschalten. Jede neue Funktion in `public` braucht deshalb ein eigenes `revoke … from public, anon`
-- (so wie claim_tenant und property_totals weiter unten).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on
  public.profiles, public.properties, public.units, public.tenants,
  public.payments, public.costs, public.tickets, public.ticket_comments
  to authenticated;

grant insert (id, name, street, zip, city) on public.properties to authenticated;
grant update (name, street, zip, city) on public.properties to authenticated;

grant insert (id, property_id, name, floor, area_sqm, rooms, base_rent, utilities_prepayment)
  on public.units to authenticated;
grant update (name, floor, area_sqm, rooms, base_rent, utilities_prepayment)
  on public.units to authenticated;

grant insert (id, unit_id, name, email, phone, move_in, invite_code) on public.tenants to authenticated;
grant update (name, email, phone, move_in, invite_code) on public.tenants to authenticated;

grant insert (id, tenant_id, month, rent_due, utilities_due) on public.payments to authenticated;
grant update (paid, paid_on) on public.payments to authenticated;

grant insert (id, property_id, year, category, amount, key) on public.costs to authenticated;
grant delete on public.costs to authenticated;

grant insert (id, tenant_id, unit_id, title, description, category, priority)
  on public.tickets to authenticated;
grant update (status) on public.tickets to authenticated;

grant insert (id, ticket_id, text) on public.ticket_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Funktionen für die App (per RPC aufrufbar)
-- ---------------------------------------------------------------------------

-- Fehlversuche beim Einlösen von Einladungscodes (Schutz gegen Raten)
create table private.claim_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index on private.claim_attempts (user_id, at);

-- Verknüpft das angemeldete Mieter-Konto mit dem Mieter-Datensatz zum Einladungscode.
-- Rückgabe: 'ok', 'invalid' (Code unbekannt/benutzt), 'throttled' (zu viele Fehlversuche),
-- 'already_linked' (Konto ist schon verknüpft) oder 'not_allowed' (kein Mieter-Konto).
create function public.claim_tenant(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if (select p.role from public.profiles p where p.id = v_uid) is distinct from 'mieter' then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.tenants t where t.user_id = v_uid) then
    return 'already_linked';
  end if;

  delete from private.claim_attempts where at < now() - interval '1 day';
  if (select count(*) from private.claim_attempts a
      where a.user_id = v_uid and a.at > now() - interval '15 minutes') >= 5 then
    return 'throttled';
  end if;

  update public.tenants
     set user_id = v_uid, invite_code = null
   where invite_code = v_code and user_id is null and v_code ~ '^[0-9A-F]{12}$'
  returning id into v_tenant;

  if v_tenant is null then
    insert into private.claim_attempts (user_id) values (v_uid);
    return 'invalid';
  end if;
  return 'ok';
end;
$$;

-- Gesamtfläche und Anzahl der Wohnungen im Haus des Mieters. Für die Nebenkostenabrechnung
-- nötig, ohne dass Mieter die Wohnungen anderer Mieter sehen.
create function public.property_totals()
returns table (property_id uuid, total_area numeric, unit_count integer)
language sql stable security definer set search_path = '' as $$
  select u.property_id, sum(u.area_sqm), count(*)::integer
  from public.units u
  where u.property_id = private.my_property_id()
  group by u.property_id
$$;

-- Neue Funktionen sind standardmäßig für PUBLIC ausführbar; nur angemeldete Nutzer dürfen sie aufrufen.
revoke all on function public.claim_tenant(text), public.property_totals() from public, anon;
grant execute on function public.claim_tenant(text), public.property_totals() to authenticated;
