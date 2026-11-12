create table if not exists card_sharing (
  user_id bigint primary key,
  enabled boolean not null,
  version text not null,
  updated_at timestamptz not null default now()
);
