-- Create a public profiles table linked to auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  streak integer default 0,
  total_points integer default 0,
  attendance_rate numeric default 100.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can update their own profile." on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user registration automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, streak, total_points, attendance_rate)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student Hero'),
    new.raw_user_meta_data->>'avatar_url',
    0,
    0,
    100.0
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to sync new auth user creation to public.profiles
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create Check-ins table
create table public.check_ins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  game_name text,
  points_earned integer not null,
  week_number integer not null,
  is_bonus boolean default false,
  student_input text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on check-ins
alter table public.check_ins enable row level security;

create policy "Users can view all check-ins." on public.check_ins
  for select using (true);

create policy "Users can insert their own check-in." on public.check_ins
  for insert with check (auth.uid() = user_id);

-- Create Activity Log table
create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  activity_type text not null,
  description text not null,
  points integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on activity_log
alter table public.activity_log enable row level security;

create policy "Users can view all activity logs." on public.activity_log
  for select using (true);

-- Function to handle check-in effects on profile and activity logs
create or replace function public.handle_check_in()
returns trigger as $$
begin
  -- 1. Update Profile points, increment streak, and set attendance rate
  update public.profiles
  set 
    total_points = total_points + new.points_earned,
    streak = streak + 1,
    attendance_rate = coalesce((
      select round((count(distinct week_number)::numeric / 16.0) * 100.0, 1)
      from public.check_ins
      where user_id = new.user_id
    ), 95.0)
  where id = new.user_id;

  -- 2. Insert corresponding activity log
  insert into public.activity_log (user_id, activity_type, description, points)
  values (
    new.user_id,
    case when new.is_bonus then 'Feedback Bonus' else 'Lecture Attended' end,
    new.subject || ' • Week ' || new.week_number,
    new.points_earned
  );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to run after checking in
create or replace trigger on_check_in_created
  after insert on public.check_ins
  for each row execute procedure public.handle_check_in();

-- Enable Supabase Realtime updates on profiles for the leaderboard
alter publication supabase_realtime add table public.profiles;

-- Create Teacher Settings table
create table if not exists public.teacher_settings (
  id integer primary key default 1,
  current_week integer not null default 1,
  session_open boolean not null default true,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on teacher_settings
alter table public.teacher_settings enable row level security;

-- Policies for teacher_settings
create policy "Allow public read access to teacher_settings" on public.teacher_settings
  for select using (true);

create policy "Allow all updates to teacher_settings" on public.teacher_settings
  for update using (true);

-- Insert initial default row
insert into public.teacher_settings (id, current_week, session_open)
values (1, 1, true)
on conflict (id) do nothing;

-- Enable Realtime updates on teacher_settings
alter publication supabase_realtime add table public.teacher_settings;

-- Allow check-ins to be deleted (e.g. for resets)
create policy "Allow delete on check-ins for everyone." on public.check_ins
  for delete using (true);

-- Function to handle check-in deletion (adjust profile points and streak)
create or replace function public.handle_check_in_delete()
returns trigger as $$
begin
  -- 1. Deduct points and decrement streak in profiles
  update public.profiles
  set 
    total_points = greatest(0, total_points - old.points_earned),
    streak = greatest(0, streak - 1),
    attendance_rate = coalesce((
      select round((count(distinct week_number)::numeric / 16.0) * 100.0, 1)
      from public.check_ins
      where user_id = old.user_id
    ), 0.0)
  where id = old.user_id;

  -- 2. Insert corresponding activity log indicating the reset/reduction
  insert into public.activity_log (user_id, activity_type, description, points)
  values (
    old.user_id,
    'Attendance Reset',
    'Reset attendance for Week ' || old.week_number,
    -old.points_earned
  );

  return old;
end;
$$ language plpgsql security definer;

-- Trigger to run after deleting a check-in
create or replace trigger on_check_in_deleted
  after delete on public.check_ins
  for each row execute procedure public.handle_check_in_delete();

