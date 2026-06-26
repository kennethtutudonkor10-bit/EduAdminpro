-- =============================================================================
-- EduAdmin Pro — Supabase PostgreSQL Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- =============================================================================

-- ── Prerequisites ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── User role enum ────────────────────────────────────────────────────────────
do $$ begin
    create type public.user_role as enum ('ADMIN', 'TEACHER', 'PARENT');
exception when duplicate_object then null;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SCHOOLS
-- Each row represents one school. The unique_code is a short identifier
-- (e.g. "GHS-001") that staff use to look up their school during onboarding.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.schools (
    id          uuid        primary key default uuid_generate_v4(),
    name        text        not null,
    unique_code text        not null unique,
    created_at  timestamptz not null default now()
);

alter table public.schools enable row level security;


-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- One row per authenticated user. Extends auth.users with school membership
-- and role. The trigger below keeps this in sync with new sign-ups.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id         uuid             primary key references auth.users(id) on delete cascade,
    school_id  uuid             references public.schools(id) on delete set null,
    full_name  text             not null,
    role       public.user_role not null default 'TEACHER',
    avatar_url text,
    created_at timestamptz      not null default now(),
    updated_at timestamptz      not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile row whenever a new auth user is created.
-- Admins must set role and full_name in raw_user_meta_data when calling
-- supabase.auth.admin.createUser({ user_metadata: { role: "TEACHER", full_name: "..." } })
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        coalesce(
            (new.raw_user_meta_data ->> 'role')::public.user_role,
            'TEACHER'::public.user_role
        )
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Keep updated_at current on every profile edit
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
    before update on public.profiles
    for each row execute procedure public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENTS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.students (
    id         uuid        primary key default uuid_generate_v4(),
    school_id  uuid        not null references public.schools(id) on delete cascade,
    full_name  text        not null,
    class_name text        not null,
    created_at timestamptz not null default now()
);

alter table public.students enable row level security;


-- ─────────────────────────────────────────────────────────────────────────────
-- TERMINAL REPORTS
-- One row per student × term × subject. The `total` column is auto-computed.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.terminal_reports (
    id          uuid           primary key default uuid_generate_v4(),
    student_id  uuid           not null references public.students(id) on delete cascade,
    school_id   uuid           not null references public.schools(id) on delete cascade,
    class_name  text           not null,
    term        text           not null,   -- "Term 1" | "Term 2" | "Term 3"
    subject     text           not null,
    test1       numeric(5, 2),
    test2       numeric(5, 2),
    homework    numeric(5, 2),
    exam        numeric(5, 2),
    total       numeric(5, 2) generated always as (
                    coalesce(test1, 0) + coalesce(test2, 0)
                    + coalesce(homework, 0) + coalesce(exam, 0)
                ) stored,
    remark      text,
    created_by  uuid           references public.profiles(id),
    created_at  timestamptz    not null default now(),
    updated_at  timestamptz    not null default now(),
    unique (student_id, term, subject)   -- one report per student/term/subject
);

alter table public.terminal_reports enable row level security;

drop trigger if exists terminal_reports_updated_at on public.terminal_reports;
create trigger terminal_reports_updated_at
    before update on public.terminal_reports
    for each row execute procedure public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS
-- target_class = NULL means the announcement is a school-wide broadcast.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.announcements (
    id           uuid        primary key default uuid_generate_v4(),
    school_id    uuid        not null references public.schools(id) on delete cascade,
    target_class text,                -- null → broadcast to entire school
    title        text        not null,
    body         text        not null,
    created_by   uuid        references public.profiles(id),
    created_at   timestamptz not null default now()
);

alter table public.announcements enable row level security;


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Helper: returns the school_id of the currently authenticated user
create or replace function public.my_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
    select school_id from public.profiles where id = auth.uid();
$$;


-- ── SCHOOLS ───────────────────────────────────────────────────────────────────
create policy "schools: members can read their own school"
    on public.schools for select
    using (id = public.my_school_id());


-- ── PROFILES ─────────────────────────────────────────────────────────────────
create policy "profiles: own row select"
    on public.profiles for select
    using (id = auth.uid());

create policy "profiles: own row update"
    on public.profiles for update
    using (id = auth.uid());

-- Admins in the same school can read all profiles
create policy "profiles: admin can view school members"
    on public.profiles for select
    using (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'ADMIN'
        )
    );


-- ── STUDENTS ─────────────────────────────────────────────────────────────────
create policy "students: school staff can read"
    on public.students for select
    using (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('ADMIN', 'TEACHER')
        )
    );

create policy "students: admin can insert"
    on public.students for insert
    with check (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'ADMIN'
        )
    );

create policy "students: admin can update"
    on public.students for update
    using (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'ADMIN'
        )
    );


-- ── TERMINAL REPORTS ─────────────────────────────────────────────────────────
create policy "reports: school staff can select"
    on public.terminal_reports for select
    using (school_id = public.my_school_id());

create policy "reports: teachers and admins can insert"
    on public.terminal_reports for insert
    with check (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('ADMIN', 'TEACHER')
        )
    );

create policy "reports: teachers and admins can update"
    on public.terminal_reports for update
    using (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('ADMIN', 'TEACHER')
        )
    );


-- ── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
create policy "announcements: all school members can read"
    on public.announcements for select
    using (school_id = public.my_school_id());

create policy "announcements: admin can insert"
    on public.announcements for insert
    with check (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'ADMIN'
        )
    );

create policy "announcements: admin can update"
    on public.announcements for update
    using (
        school_id = public.my_school_id()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'ADMIN'
        )
    );
