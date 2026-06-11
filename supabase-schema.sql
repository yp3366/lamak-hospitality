-- ============================================
-- LAMAK HOSPITALITY UNIT - SUPABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================

-- USERS TABLE
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  password_hash text not null,
  gender text check (gender in ('Male','Female')),
  level text check (level in ('100L','200L','300L','400L','Staff','Other')),
  role text default 'Member',
  custom_role text,
  custom_role_color text default '#6c7fff',
  subunit_id uuid,
  status text default 'Active' check (status in ('Active','Probation','Suspended','Expelled')),
  is_admin boolean default false,
  profile_pic text,
  banner_image text,
  bio text,
  favorite_verse text,
  skills text,
  profile_color text default '#6c7fff',
  social_links jsonb default '{}',
  join_date timestamp with time zone default now(),
  last_seen timestamp with time zone default now(),
  email_verified boolean default false,
  created_at timestamp with time zone default now()
);

-- SUBUNITS TABLE
create table if not exists subunits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text default '✦',
  color text default '#6c7fff',
  head_id uuid references users(id),
  assistant_head_id uuid references users(id),
  is_registration_open boolean default true,
  created_at timestamp with time zone default now()
);

-- Add foreign key for subunit to users
alter table users add constraint fk_subunit foreign key (subunit_id) references subunits(id) on delete set null;

-- ATTENDANCE TABLE
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  date date not null,
  service_type text check (service_type in ('Sunday','Tuesday','Thursday','Special')),
  present boolean default true,
  marked_by uuid references users(id),
  created_at timestamp with time zone default now(),
  unique(user_id, date, service_type)
);

-- ANNOUNCEMENTS TABLE
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid references users(id),
  is_pinned boolean default false,
  attachment_url text,
  attachment_type text,
  created_at timestamp with time zone default now()
);

-- EVENTS TABLE
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamp with time zone not null,
  event_type text check (event_type in ('Chapel','Meeting','Evangelism','Training','Other')),
  location text,
  created_by uuid references users(id),
  created_at timestamp with time zone default now()
);

-- MESSAGES TABLE (Global Chat)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel text default 'general',
  user_id uuid references users(id) on delete cascade,
  content text not null,
  image_url text,
  reply_to uuid references messages(id),
  is_pinned boolean default false,
  is_deleted boolean default false,
  reactions jsonb default '{}',
  created_at timestamp with time zone default now(),
  edited_at timestamp with time zone
);

-- DIRECT MESSAGES TABLE
create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete cascade,
  receiver_id uuid references users(id) on delete cascade,
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- FRIEND REQUESTS TABLE
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete cascade,
  receiver_id uuid references users(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamp with time zone default now(),
  unique(sender_id, receiver_id)
);

-- NOTIFICATIONS TABLE
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  link text,
  created_at timestamp with time zone default now()
);

-- AUDIT LOG TABLE
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users(id),
  action text not null,
  target_user_id uuid references users(id),
  details text,
  created_at timestamp with time zone default now()
);

-- MEMBER STATUS HISTORY
create table if not exists status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  old_status text,
  new_status text,
  reason text,
  changed_by uuid references users(id),
  created_at timestamp with time zone default now()
);

-- FILES TABLE
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  file_type text,
  folder text default 'General',
  uploaded_by uuid references users(id),
  created_at timestamp with time zone default now()
);

-- PASSWORD RESET TOKENS
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null,
  expires_at timestamp with time zone not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

-- EMAIL VERIFICATION TOKENS
create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- ============================================
-- SEED DEFAULT ADMIN USER
-- Password: Admin@1234 (change after first login)
-- ============================================
insert into users (full_name, email, password_hash, gender, level, role, is_admin, email_verified, status)
values (
  'System Admin',
  'admin@lamak.edu.ng',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Male',
  'Staff',
  'President',
  true,
  true,
  'Active'
);

-- SEED SAMPLE SUBUNITS
insert into subunits (name, description, icon, color) values
  ('Ushering', 'Front-of-house and hospitality coordination', '🤲', '#6c7fff'),
  ('Media Team', 'Photography, video, and livestream', '📸', '#34d6b0'),
  ('Evangelism', 'Outreach and soul-winning', '✝️', '#f59e0b'),
  ('Prayer Team', 'Intercession and spiritual covering', '🙏', '#a78bfa'),
  ('Welfare', 'Member care and support', '❤️', '#f87171'),
  ('Decoration', 'Venue setup and aesthetics', '🌸', '#4ade80');

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table users enable row level security;
alter table attendance enable row level security;
alter table messages enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table direct_messages enable row level security;

-- Allow all via service role (our functions use service key)
create policy "Service role full access" on users for all using (true);
create policy "Service role full access" on attendance for all using (true);
create policy "Service role full access" on messages for all using (true);
create policy "Service role full access" on announcements for all using (true);
create policy "Service role full access" on notifications for all using (true);
create policy "Service role full access" on direct_messages for all using (true);
create policy "Service role full access" on subunits for all using (true);
create policy "Service role full access" on events for all using (true);
create policy "Service role full access" on friend_requests for all using (true);
create policy "Service role full access" on audit_logs for all using (true);
create policy "Service role full access" on status_history for all using (true);
create policy "Service role full access" on files for all using (true);
create policy "Service role full access" on notifications for all using (true);

-- ============================================
-- DONE! Your schema is ready.
-- ============================================
