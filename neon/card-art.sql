-- Rank card pictures chosen by students (Tweaks on /card): the picture is kept only as 80x40 gray cells, never the image.
-- A student without a row uses their 42 photo. The app creates this table on first use (src/lib/card-art-store.ts).
create table if not exists card_art (
  user_id bigint primary key check (user_id > 0),
  source text not null check (source in ('upload', 'github', 'link')),
  label text not null default '',
  cells text not null,
  updated_at timestamptz not null default now()
);
