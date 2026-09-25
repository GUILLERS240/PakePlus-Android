# Configuración de Supabase para Lumi

Este archivo reemplaza el esquema anterior. **Haz una copia de seguridad de la base de datos antes de ejecutar el bloque de reinicio**, porque elimina las tablas y funciones indicadas por el proyecto.

1. Crea/abre tu proyecto en Supabase.
2. En **SQL Editor**, ejecuta el bloque completo de abajo.
3. En **Authentication → Providers**, habilita Email.
4. En `js/config.js`, configura `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
5. Durante esta fase de pruebas, las claves de OpenRouter y PlataformIA permanecen en `js/config.js`, tal como solicita el proyecto. Para producción deben moverse a un backend/Edge Function.
6. Realtime se habilita mediante la publicación `supabase_realtime` para `messages`, `notifications` y `conversations`.

> **Nota sobre `lumi_diary`:** RLS está activo y no existe una política de SELECT/UPDATE/DELETE para el usuario. El cliente puede insertar su propia entrada para que Lumi pueda escribir el diario, pero no puede leerlo mediante PostgREST. Una función/backend con privilegios puede leerlo si en el futuro se necesita procesamiento administrativo.

## Reinicio y creación del esquema

```sql
-- ============================================================
-- 0) EXTENSIÓN
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1) LIMPIEZA SOLICITADA
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user on profiles;
drop trigger if exists update_profiles_updated_at on profiles;
drop trigger if exists update_projects_updated_at on projects;
drop trigger if exists update_conversations_updated_at on conversations;
drop trigger if exists update_settings_updated_at on settings;
drop trigger if exists update_lists_updated_at on lists;
drop trigger if exists update_last_mentioned_on_message on messages;
drop trigger if exists reset_tokens_before_profile_update on profiles;

drop function if exists on_auth_user_created() cascade;
drop function if exists handle_new_user() cascade;
drop function if exists update_updated_at() cascade;
drop function if exists update_memory_last_mentioned() cascade;
drop function if exists reset_daily_tokens() cascade;

drop table if exists feedback cascade;
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists projects cascade;
drop table if exists memories cascade;
drop table if exists learning_rules cascade;
drop table if exists security cascade;
drop table if exists notifications cascade;
drop table if exists settings cascade;
drop table if exists profiles cascade;
drop table if exists reminders cascade;
drop table if exists lists cascade;
drop table if exists lumi_diary cascade;

-- ============================================================
-- 2) FUNCIONES AUXILIARES
-- ============================================================
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, display_name, lumi_name, language, theme,
    lumi_auto_message, cuban_slang, listen_mode, plan,
    tokens_used_today, tokens_reset_at, onboarding_done,
    last_seen, created_at, updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    'Lumi', 'es', 'dark',
    true, false, false, 'free',
    0, now(), false,
    now(), now(), now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.handle_new_user();
  return new;
end;
$$;

create or replace function create_profile_dependencies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.security (user_id, recovery_email)
  select new.id, u.email
  from auth.users u
  where u.id = new.id
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function create_first_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversations (project_id, user_id, title, mode, summary)
  values (new.id, new.user_id, 'Nueva conversación', 'assistant', '');
  return new;
end;
$$;

create or replace function update_memory_last_mentioned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if new.role <> 'user' then
    return new;
  end if;

  select user_id into owner_id
  from public.conversations
  where id = new.conversation_id;

  if owner_id is null then
    return new;
  end if;

  update public.memories
  set last_mentioned = now()
  where user_id = owner_id
    and content is not null
    and length(trim(content)) > 0
    and lower(new.content) like '%' || lower(content) || '%';

  return new;
end;
$$;

create or replace function reset_daily_tokens()
returns trigger
language plpgsql
as $$
begin
  if new.tokens_reset_at is null or new.tokens_reset_at < now() then
    new.tokens_used_today = 0;
    new.tokens_reset_at = now();
  end if;
  return new;
end;
$$;

-- ============================================================
-- 3) TABLAS — 13 EN TOTAL
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  lumi_name text not null default 'Lumi',
  language text not null default 'es',
  theme text not null default 'dark',
  lumi_auto_message boolean not null default true,
  cuban_slang boolean not null default false,
  listen_mode boolean not null default false,
  plan text not null default 'free',
  tokens_used_today integer not null default 0,
  tokens_reset_at timestamptz not null default now(),
  onboarding_done boolean not null default false,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  mode text not null default 'assistant',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  mode text not null default 'assistant',
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  used_for_learning boolean not null default false,
  created_at timestamptz not null default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  content text not null,
  weight integer not null default 1,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  last_mentioned timestamptz
);

create table learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table security (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code_hash text,
  recovery_email text,
  failed_attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  remind_at timestamptz not null,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lumi_diary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ============================================================
-- 4) RLS
-- ============================================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table memories enable row level security;
alter table learning_rules enable row level security;
alter table security enable row level security;
alter table notifications enable row level security;
alter table settings enable row level security;
alter table reminders enable row level security;
alter table lists enable row level security;
alter table lumi_diary enable row level security;

create policy profiles_select_own on profiles for select using (auth.uid() = id);
create policy profiles_insert_own on profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete_own on profiles for delete using (auth.uid() = id);

create policy projects_select_own on projects for select using (auth.uid() = user_id);
create policy projects_insert_own on projects for insert with check (auth.uid() = user_id);
create policy projects_update_own on projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_delete_own on projects for delete using (auth.uid() = user_id);

create policy conversations_select_own on conversations for select using (auth.uid() = user_id);
create policy conversations_insert_own on conversations for insert with check (auth.uid() = user_id);
create policy conversations_update_own on conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy conversations_delete_own on conversations for delete using (auth.uid() = user_id);

-- messages no longer stores user_id: ownership is inherited through conversation.
create policy messages_select_own on messages for select
using (exists (
  select 1 from conversations c
  where c.id = messages.conversation_id and c.user_id = auth.uid()
));
create policy messages_insert_own on messages for insert
with check (exists (
  select 1 from conversations c
  where c.id = messages.conversation_id and c.user_id = auth.uid()
));
create policy messages_update_own on messages for update
using (exists (
  select 1 from conversations c
  where c.id = messages.conversation_id and c.user_id = auth.uid()
))
with check (exists (
  select 1 from conversations c
  where c.id = messages.conversation_id and c.user_id = auth.uid()
));
create policy messages_delete_own on messages for delete
using (exists (
  select 1 from conversations c
  where c.id = messages.conversation_id and c.user_id = auth.uid()
));

create policy feedback_select_own on feedback for select using (auth.uid() = user_id);
create policy feedback_insert_own on feedback for insert with check (auth.uid() = user_id);
create policy feedback_update_own on feedback for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy feedback_delete_own on feedback for delete using (auth.uid() = user_id);

create policy memories_select_own on memories for select using (auth.uid() = user_id);
create policy memories_insert_own on memories for insert with check (auth.uid() = user_id);
create policy memories_update_own on memories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy memories_delete_own on memories for delete using (auth.uid() = user_id);

create policy learning_rules_select_own on learning_rules for select using (auth.uid() = user_id);
create policy learning_rules_insert_own on learning_rules for insert with check (auth.uid() = user_id);
create policy learning_rules_update_own on learning_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy learning_rules_delete_own on learning_rules for delete using (auth.uid() = user_id);

create policy security_select_own on security for select using (auth.uid() = user_id);
create policy security_insert_own on security for insert with check (auth.uid() = user_id);
create policy security_update_own on security for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy security_delete_own on security for delete using (auth.uid() = user_id);

create policy notifications_select_own on notifications for select using (auth.uid() = user_id);
create policy notifications_insert_own on notifications for insert with check (auth.uid() = user_id);
create policy notifications_update_own on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete_own on notifications for delete using (auth.uid() = user_id);

create policy settings_select_own on settings for select using (auth.uid() = user_id);
create policy settings_insert_own on settings for insert with check (auth.uid() = user_id);
create policy settings_update_own on settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy settings_delete_own on settings for delete using (auth.uid() = user_id);

create policy reminders_select_own on reminders for select using (auth.uid() = user_id);
create policy reminders_insert_own on reminders for insert with check (auth.uid() = user_id);
create policy reminders_update_own on reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reminders_delete_own on reminders for delete using (auth.uid() = user_id);

create policy lists_select_own on lists for select using (auth.uid() = user_id);
create policy lists_insert_own on lists for insert with check (auth.uid() = user_id);
create policy lists_update_own on lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lists_delete_own on lists for delete using (auth.uid() = user_id);

-- lumi_diary: RLS is active; no SELECT/UPDATE/DELETE policy is granted to the user.
create policy lumi_diary_insert_own on lumi_diary for insert
with check (auth.uid() = user_id);

-- ============================================================
-- 5) TRIGGERS
-- ============================================================
create trigger on_auth_user_created
after insert on auth.users
for each row execute function on_auth_user_created();

create trigger handle_new_user
after insert on profiles
for each row execute function create_profile_dependencies();

create trigger create_conversation_after_project
after insert on projects
for each row execute function create_first_conversation();

create trigger update_profiles_updated_at
before update on profiles
for each row execute function update_updated_at();

create trigger update_projects_updated_at
before update on projects
for each row execute function update_updated_at();

create trigger update_conversations_updated_at
before update on conversations
for each row execute function update_updated_at();

create trigger update_settings_updated_at
before update on settings
for each row execute function update_updated_at();

create trigger update_lists_updated_at
before update on lists
for each row execute function update_updated_at();

create trigger reset_tokens_before_profile_update
before update on profiles
for each row execute function reset_daily_tokens();

create trigger update_last_mentioned_on_message
after insert on messages
for each row execute function update_memory_last_mentioned();

-- ============================================================
-- 6) ÍNDICES SOLICITADOS
-- ============================================================
create index idx_profiles_id on profiles(id);
create index idx_projects_user_id on projects(user_id);
create index idx_conversations_user_id on conversations(user_id);
create index idx_conversations_project_id on conversations(project_id);
create index idx_messages_conversation_id on messages(conversation_id);
create index idx_feedback_user_id on feedback(user_id);
create index idx_memories_user_id on memories(user_id);
create index idx_learning_rules_user_id on learning_rules(user_id);
create index idx_security_user_id on security(user_id);
create index idx_notifications_user_id on notifications(user_id);
create index idx_settings_user_id on settings(user_id);
create index idx_reminders_user_id on reminders(user_id);
create index idx_reminders_remind_at on reminders(remind_at);
create index idx_lists_user_id on lists(user_id);
create index idx_diary_user_id on lumi_diary(user_id);
create index idx_diary_date on lumi_diary(date);

-- ============================================================
-- 7) REALTIME
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table conversations;
  exception when duplicate_object then null;
  end;
end $$;
```

## Comprobación rápida

Después de ejecutar el script:

```sql
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
```

Deben existir las 13 tablas: `profiles`, `projects`, `conversations`, `messages`, `feedback`, `memories`, `learning_rules`, `security`, `notifications`, `settings`, `reminders`, `lists` y `lumi_diary`.

Para comprobar Realtime:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('messages','notifications','conversations');
```
