create table if not exists data_snapshots (
  key text primary key,
  payload jsonb,
  lease text,
  lease_until timestamptz
);
