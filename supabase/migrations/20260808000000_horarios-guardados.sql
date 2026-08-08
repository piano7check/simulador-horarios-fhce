create table horarios_guardados (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  carrera_id integer not null,
  grupos text[] not null default '{}',
  updated_at timestamptz default now(),
  unique(user_id, carrera_id)
);

alter table horarios_guardados enable row level security;

create policy "users_own_horarios" on horarios_guardados
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
