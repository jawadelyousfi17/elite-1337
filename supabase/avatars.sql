-- Run once in the Supabase SQL editor. The app uses only its server-side
-- service-role key; browser clients receive neither the key nor direct access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-avatars', 'student-avatars', false, 1048576, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.student_avatars (
  user_id bigint primary key check (user_id > 0),
  version text not null check (version ~ '^[a-f0-9]{32}$'),
  object_path text not null unique,
  updated_at timestamptz not null default now(),
  constraint avatar_path_matches_user check (object_path = user_id::text || '/' || version || '.webp')
);

alter table public.student_avatars enable row level security;
-- No anon/authenticated policies: only the server-side service role may read
-- or change mappings and objects. Ownership is enforced by Auth.js routes.
