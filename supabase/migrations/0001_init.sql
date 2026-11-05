-- PoP: Proof of Purchase. Private state only (Architecture §9).
-- Public truth lives on Whitechain (money/state) and Arkiv (reputation). Never store raw buyer PII unencrypted.

create table if not exists sellers (
  id               bigserial primary key,
  wallet           text not null unique,            -- lowercase 0x address
  handle           text not null,
  handle_hash      text not null,
  handle_tier      smallint not null default 0,     -- 0 unverified, 1 staff-checked bio code, 2 Reclaim
  bio_code         text,                            -- tier-1 proof code shown to the seller
  api_key_hash     text,
  webhook_url      text,
  webhook_secret_enc text,
  created_at       timestamptz not null default now()
);
create unique index if not exists sellers_handle_hash_uq on sellers (handle_hash);

create table if not exists listings (
  id           text primary key,                    -- short slug used in /p/[listingId]
  seller_id    bigint not null references sellers(id),
  title        text not null,
  image_url    text,
  price_units  numeric(78,0) not null,              -- test-USDT base units
  terms_json   jsonb not null,
  terms_hash   text not null,
  offer_json   jsonb not null,
  offer_sig    text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists checkout_sessions (
  id                 text primary key,
  seller_id          bigint not null references sellers(id),
  external_order_id  text not null,
  offer_json         jsonb not null,
  offer_sig          text not null,
  return_url         text,
  webhook_url        text,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now()
);

create table if not exists orders (
  order_id        numeric(78,0) primary key,        -- on-chain order id
  seller_wallet   text not null,
  buyer_wallet    text not null,
  listing_id      text references listings(id),
  session_id      text references checkout_sessions(id),
  amount_units    numeric(78,0) not null,
  state           text not null,
  address_enc     text,                             -- AES-256-GCM ciphertext (iv:tag:data, base64)
  tracking_no     text,
  courier_status  text,                             -- SIMULATED, DB only
  fund_tx         text,
  ship_tx         text,
  deliver_tx      text,
  final_tx        text,
  updated_at      timestamptz not null default now()
);
create index if not exists orders_seller_idx on orders (seller_wallet);
create index if not exists orders_buyer_idx on orders (buyer_wallet);

-- One review per unique human PER SELLER. The raw nullifier never leaves this table.
create table if not exists review_nullifiers (
  nullifier_hash  text not null,
  seller_wallet   text not null,
  order_id        numeric(78,0) not null,
  created_at      timestamptz not null default now(),
  constraint review_nullifiers_human_seller_uq unique (nullifier_hash, seller_wallet)
);

create table if not exists reviews (
  id             bigserial primary key,
  order_id       numeric(78,0) not null unique,
  seller_wallet  text not null,
  buyer_wallet   text not null,
  rating         smallint not null check (rating between 1 and 5),
  text           text,
  arkiv_key      text,
  status         text not null default 'pending',   -- pending | synced | failed
  created_at     timestamptz not null default now()
);

create table if not exists arkiv_writes (
  id          bigserial primary key,
  kind        text not null,                        -- seller | review | outcome
  ref_id      text not null,
  entity_key  text,
  tx_hash     text,
  status      text not null default 'pending',      -- pending | synced | failed
  error       text,
  updated_at  timestamptz not null default now(),
  constraint arkiv_writes_kind_ref_uq unique (kind, ref_id)
);

-- Idempotency for every chain-derived write.
create table if not exists processed_events (
  chain_id   integer not null,
  tx_hash    text not null,
  log_index  integer not null,
  primary key (chain_id, tx_hash, log_index)
);

create table if not exists webhook_deliveries (
  id          bigserial primary key,
  session_id  text references checkout_sessions(id),
  event       text not null,
  status      text not null default 'pending',
  attempts    integer not null default 0,
  last_error  text,
  updated_at  timestamptz not null default now()
);

create table if not exists faucet_grants (
  address     text primary key,
  ip_hash     text,
  wbt_tx      text,
  usdt_tx     text,
  created_at  timestamptz not null default now()
);

create table if not exists disputes (
  order_id        numeric(78,0) primary key,
  evidence_urls   jsonb,
  evidence_hash   text,
  decision        text,
  decision_hash   text,
  resolved_tx     text
);
