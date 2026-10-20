-- Splitcart schema. Money is numeric(10,2) in GBP; quantities are in the
-- product's own unit (kg, litre, each). Idempotent so `npm run db:migrate` can rerun.

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,                      -- cafe | restaurant | takeaway | shop | other
  access_hash text not null,               -- scrypt "salt:hash" of the owner's access code; the code itself is never stored
  plan text not null default 'free',       -- free = one optimisation, pro = unlimited
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  min_order numeric(10,2) not null default 0,          -- goods subtotal required to place any order
  delivery_fee numeric(10,2) not null default 0,
  free_delivery_over numeric(10,2),                    -- null = fee always charged
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unit text not null default 'each',
  needed_qty numeric(10,2) not null default 0,         -- how much this order must cover
  sell_min numeric(10,2) check (sell_min >= 0),        -- optional selling-price range (£ per unit)
  sell_max numeric(10,2) check (sell_max >= 0),
  price_tests jsonb not null default '[]',             -- [{price, weeklySold}] the owner has tried
  created_at timestamptz not null default now()
);

-- One way to buy a product from a supplier: `case_size` units for `case_price`,
-- bought in whole multiples. A supplier selling singles and cases of the same item
-- has two offers, and the solver picks the mix (UK wholesalers list both).
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  label text not null default '',                      -- e.g. "Single 1 kg", "Case 6 x 1 kg"
  case_size numeric(10,2) not null check (case_size > 0),
  case_price numeric(10,2) not null check (case_price >= 0),
  promo_price numeric(10,2) check (promo_price >= 0),  -- replaces case_price while promo_until >= today
  promo_until date,
  max_buys int check (max_buys > 0)                    -- per-order cap: promo limits, stock
);
create index if not exists offers_supplier on offers(supplier_id);

-- Every optimisation is kept so the owner can see what was recommended and when.
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  total numeric(10,2),
  baseline numeric(10,2),
  result jsonb not null
);

-- Wrong access-code attempts, for throttling (5 per business per 15 minutes).
create table if not exists auth_failures (
  key text not null,                       -- company id
  at timestamptz not null default now()
);
create index if not exists auth_failures_key on auth_failures(key, at);

alter table companies add column if not exists is_demo boolean not null default false;
alter table runs add column if not exists ip_hash text; -- salted; one free run per network per 30 days
create index if not exists runs_ip on runs(ip_hash, created_at);

-- Shared price book matching: fuzzy names (pg_trgm) and canonical units.
create extension if not exists pg_trgm;
create or replace function canon_unit(u text) returns text language sql immutable as $f$
  select case lower(trim(u))
    when 'litre' then 'l' when 'litres' then 'l' when 'liter' then 'l' when 'ltr' then 'l'
    when 'kilo' then 'kg' when 'kilos' then 'kg' when 'kgs' then 'kg'
    when 'ea' then 'each' when 'pcs' then 'each' when 'piece' then 'each' when 'unit' then 'each'
    else lower(trim(u)) end
$f$;

create index if not exists suppliers_company on suppliers(company_id);
create index if not exists products_company on products(company_id);
create index if not exists runs_company on runs(company_id, created_at desc);

-- Supplier email (orders open in the owner's mail app) and list-price history (price alerts).
alter table suppliers add column if not exists email text;
create table if not exists offer_price_changes (
  offer_id uuid not null references offers(id) on delete cascade,
  old_price numeric(10,2) not null,
  new_price numeric(10,2) not null,
  at timestamptz not null default now()
);
create index if not exists offer_price_changes_offer on offer_price_changes(offer_id, at desc);

-- Product name matching for the shared price book (see src/lib/network.ts).
create or replace function canon_name(n text) returns text language sql immutable as $f$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    ' ' || lower(n) || ' ',
    '[^a-z0-9 ]', ' ', 'g'),                                                    -- punctuation
    '\m(\d+(\.\d+)?\s*(kg|g|ml|l|litre|litres|pack|pk|x)?|case|of|pack|sleeve|bag|box|tub|raw|fresh|frozen|large|small|medium|the|and)\M', ' ', 'g'),  -- sizes, pack words
    '\m(shrimps?|king prawns?|tiger prawns?)\M', 'prawn', 'g'),                  -- synonyms
    '\mexpresso\M', 'espresso', 'g'),
    '([a-z]{3,})s\M', '\1', 'g'))                                               -- plurals
$f$;
;
create or replace function names_match(a text, b text) returns boolean language sql immutable as $f$
  select not (substring(canon_name(a) from '\d+oz') is not null and substring(canon_name(b) from '\d+oz') is not null
              and substring(canon_name(a) from '\d+oz') <> substring(canon_name(b) from '\d+oz'))
    and (similarity(canon_name(a), canon_name(b)) >= 0.6
      or (array_length(string_to_array(canon_name(a), ' '), 1) >= 2 and string_to_array(canon_name(a), ' ') <@ string_to_array(canon_name(b), ' '))
      or (array_length(string_to_array(canon_name(b), ' '), 1) >= 2 and string_to_array(canon_name(b), ' ') <@ string_to_array(canon_name(a), ' ')))
$f$
;
