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

create index if not exists suppliers_company on suppliers(company_id);
create index if not exists products_company on products(company_id);
create index if not exists runs_company on runs(company_id, created_at desc);
