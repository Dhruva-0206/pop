-- PoP: Proof of Purchase. Private state only (Architecture §9).
-- Public truth lives on Whitechain (money/state) and Arkiv (reputation). Never store raw buyer PII unencrypted.
--
-- Applied by `npm run db:migrate` (scripts/db-migrate.ts) into ONE schema per network mode:
--   NETWORK_MODE=testnet -> schema "public"   (real data)
--   NETWORK_MODE=fork    -> schema "pop_fork" (local anvil fork test data; `npm run db:reset-fork` wipes it)
-- The file is idempotent AND upgrades a database that has an earlier version of 0001 applied: every column the code
-- needs is also added with `add column if not exists`, nothing is ever dropped.
-- Tables marked (planned) are not used by the code yet (demo store / outcome entities).
-- Chain truth (order state, deadlines, balances) is NEVER cached here: `orders.state` stays unused and nullable.

create table if not exists sellers (
  id               bigserial primary key,
  wallet           text not null unique,            -- lowercase 0x address
  handle           text not null,                   -- lowercase
  handle_hash      text not null,
  handle_tier      smallint not null default 0,     -- 0 unverified, 1 staff-checked bio code, 2 Reclaim
  bio_code         text,                            -- tier-1 proof code shown to the seller
  api_key_hash     text,                            -- (planned) demo store
  webhook_url      text,                            -- (planned)
  webhook_secret_enc text,                          -- (planned)
  created_at       timestamptz not null default now()
);
create unique index if not exists sellers_handle_hash_uq on sellers (handle_hash);
create unique index if not exists sellers_handle_uq on sellers (handle);

create table if not exists listings (
  id           text primary key,                    -- short slug used in /p/[listingId]
  seller_id    bigint not null references sellers(id),
  title        text not null,
  image_url    text,
  price_units  numeric(78,0) not null,              -- test-USDT base units
  price_inr    integer not null default 0,          -- display price in rupees
  terms_json   jsonb not null,
  terms_hash   text not null,
  offer_json   jsonb not null,
  offer_sig    text not null,
  listing_id_hash text,                             -- keccak(slug): Offer.listingId on-chain, lowercase hex
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table listings add column if not exists price_inr integer not null default 0;
alter table listings add column if not exists listing_id_hash text;
create index if not exists listings_id_hash_idx on listings (listing_id_hash);

create table if not exists checkout_sessions (       -- (planned) "Pay with PoP" on other websites
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
  order_id        numeric(78,0) primary key,        -- on-chain order id (unique per schema, i.e. per network mode)
  seller_wallet   text not null,                    -- lowercase
  buyer_wallet    text not null,                    -- lowercase
  listing_id      text references listings(id),
  session_id      text references checkout_sessions(id),
  amount_units    numeric(78,0) not null,
  state           text,                             -- UNUSED: chain is the source of truth for state
  address_enc     text,                             -- AES-256-GCM ciphertext (iv.tag.data, base64)
  tracking_no     text,
  courier_status  text,                             -- SIMULATED, DB only
  fund_tx         text,
  ship_tx         text,                             -- (unused so far)
  deliver_tx      text,                             -- (unused so far)
  final_tx        text,                             -- (unused so far)
  updated_at      timestamptz not null default now()
);
alter table orders alter column state drop not null;
create index if not exists orders_seller_idx on orders (seller_wallet);
create index if not exists orders_buyer_idx on orders (buyer_wallet);

-- One review per unique human PER SELLER. Only a hash of the nullifier is stored; the raw nullifier never lands here.
-- The server claims a review by INSERTing here (this unique constraint IS the atomic check) in the same transaction
-- as the pending `reviews` row, so a claim is never half-made and a retry never needs a second row.
create table if not exists review_nullifiers (
  nullifier_hash  text not null,
  seller_wallet   text not null,
  order_id        numeric(78,0) not null,
  created_at      timestamptz not null default now(),
  constraint review_nullifiers_human_seller_uq unique (nullifier_hash, seller_wallet)
);

create table if not exists reviews (
  id             bigserial primary key,
  order_id       numeric(78,0) not null unique,     -- one review per order
  seller_wallet  text not null,
  seller_handle  text,
  buyer_wallet   text not null,
  rating         smallint not null check (rating between 1 and 5),
  text           text,
  reviewer_key   text,                              -- public: keccak(nullifier, seller), or 'dev-...' for DEV skip-World reviews
  buyer_sig      text,                              -- buyer's signature over (order, seller, rating, keccak(text))
  pay_tx         text,
  dev_skipped_world boolean not null default false, -- DEV flag only; never true on a deployed build
  buyer_history  smallint not null default 0,       -- bucket lower bound: 1, 2 (2-5) or 6 (6+) protected orders by this buyer
  arkiv_key      text,
  create_tx      text,
  transfer_tx    text,
  error          text,
  status         text not null default 'pending',   -- pending | synced | failed (Arkiv publish state)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint reviews_status_check check (status in ('pending','synced','failed')),
  constraint reviews_text_len_check check (text is null or char_length(text) <= 500)
);
alter table reviews add column if not exists seller_handle text;
alter table reviews add column if not exists reviewer_key text;
alter table reviews add column if not exists buyer_sig text;
alter table reviews add column if not exists pay_tx text;
alter table reviews add column if not exists dev_skipped_world boolean not null default false;
alter table reviews add column if not exists buyer_history smallint not null default 0;
alter table reviews add column if not exists create_tx text;
alter table reviews add column if not exists transfer_tx text;
alter table reviews add column if not exists error text;
alter table reviews add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table reviews add constraint reviews_status_check check (status in ('pending','synced','failed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table reviews add constraint reviews_text_len_check check (text is null or char_length(text) <= 500);
exception when duplicate_object then null; end $$;
create index if not exists reviews_seller_idx on reviews (seller_wallet);

create table if not exists arkiv_writes (            -- UNUSED today: review publish state lives on `reviews`. Kept for outcome entities.
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

-- Idempotency for every chain-derived write (orders are registered at most once per chain event).
create table if not exists processed_events (
  chain_id   integer not null,
  tx_hash    text not null,
  log_index  integer not null,
  primary key (chain_id, tx_hash, log_index)
);

create table if not exists webhook_deliveries (      -- (planned) demo store
  id          bigserial primary key,
  session_id  text references checkout_sessions(id),
  event       text not null,
  status      text not null default 'pending',
  attempts    integer not null default 0,
  last_error  text,
  updated_at  timestamptz not null default now()
);

create table if not exists faucet_grants (
  address     text primary key,                     -- lowercase
  ip_hash     text,
  gas_tx      text,
  usdt_tx     text,
  created_at  timestamptz not null default now()
);
do $$ begin
  -- earlier versions of this file called the gas column wbt_tx
  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'faucet_grants' and column_name = 'wbt_tx')
     and not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'faucet_grants' and column_name = 'gas_tx') then
    alter table faucet_grants rename column wbt_tx to gas_tx;
  end if;
end $$;
alter table faucet_grants add column if not exists gas_tx text;
alter table faucet_grants add column if not exists usdt_tx text;
create index if not exists faucet_grants_created_idx on faucet_grants (created_at);

create table if not exists disputes (                -- (planned) arbiter page
  order_id        numeric(78,0) primary key,
  evidence_urls   jsonb,
  evidence_hash   text,
  decision        text,
  decision_hash   text,
  resolved_tx     text
);

-- Single-use seller login nonces (5 minutes).
create table if not exists login_nonces (
  nonce       text primary key,
  address     text not null,                        -- lowercase
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_nonces_addr_idx on login_nonces (address);

-- ---------------------------------------------------------------------------------------------------------------------
-- "Pay with PoP" merchants: API-key authenticated checkout sessions + HMAC-signed webhooks (packages/checkout-sdk).
-- The API key itself is never stored (sha256 only); the webhook secret is AES-256-GCM encrypted (it must be recoverable to sign).
-- A merchant sells AS one registered seller wallet: the seller signs every Offer itself, PoP never holds that key.
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists merchants (
  id                    bigserial primary key,
  name                  text not null,
  seller_wallet         text not null,                -- lowercase; must be an active registered seller
  api_key_hash          text not null,                -- sha256 hex of the API key
  webhook_url           text,
  webhook_secret_enc    text,
  allowed_return_origin text,                         -- a session's returnUrl must start with this origin
  created_at            timestamptz not null default now()
);
create unique index if not exists merchants_api_key_uq on merchants (api_key_hash);
create unique index if not exists merchants_wallet_uq on merchants (seller_wallet);

-- checkout_sessions was planned/unused: now one row per merchant session; the hosted checkout is the listing with the same id.
alter table checkout_sessions add column if not exists merchant_id bigint references merchants(id);
alter table checkout_sessions add column if not exists listing_id text references listings(id);
create index if not exists checkout_sessions_listing_idx on checkout_sessions (listing_id);

-- webhook_deliveries was planned/unused: one row per (merchant, order, event); the unique index makes enqueueing idempotent.
alter table webhook_deliveries add column if not exists merchant_id bigint references merchants(id);
alter table webhook_deliveries add column if not exists order_id numeric(78,0);
alter table webhook_deliveries add column if not exists payload jsonb;
alter table webhook_deliveries add column if not exists delivered_at timestamptz;
create unique index if not exists webhook_deliveries_uq on webhook_deliveries (merchant_id, order_id, event);

-- Where the webhook dispatcher stopped scanning chain events (per key).
create table if not exists webhook_cursor (
  key    text primary key,
  block  bigint not null
);
