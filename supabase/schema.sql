-- Library Management System (LMS)
-- Supabase Postgres schema + RLS policies + RPC for lending + analytics.

-- Optional (for better search). Enable manually if you want trigram indexes:
-- create extension if not exists pg_trgm;

-- 1) Profiles / Roles
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin allowlist (for open-source/portfolio bootstrap)
-- Add your email(s) here before signing up to automatically get role=admin.
create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Default admin email for portfolio/demo (shared admin account).
-- Change this email (and the password you set in Supabase Auth) before deploying to production.
insert into public.admin_allowlist (email)
values ('admin@lms.local')
on conflict (email) do nothing;

-- Audit logs (optional). Recommended to insert from server using SUPABASE_SERVICE_ROLE_KEY.
create table if not exists public.audit_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  request_id text,
  actor_id uuid,
  actor_email text,
  actor_role text,
  method text not null,
  path text not null,
  status_code integer not null,
  ip text,
  user_agent text,
  duration_ms integer
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Auto-create public.users row when a new Supabase Auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    case
      when exists (select 1 from public.admin_allowlist a where a.email = new.email) then 'admin'
      else 'member'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 2) Catalog
create table if not exists public.categories (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id bigserial primary key,
  title text not null,
  author text not null,
  isbn text not null unique,
  category_id bigint references public.categories (id) on delete set null,
  stock_total integer not null default 1 check (stock_total >= 0),
  stock_available integer not null default 1 check (stock_available >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_available_lte_total check (stock_available <= stock_total)
);

drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create index if not exists idx_books_title on public.books (title);
create index if not exists idx_books_author on public.books (author);
create index if not exists idx_books_category_id on public.books (category_id);

-- 3) Transactions
create table if not exists public.transactions (
  id bigserial primary key,
  book_id bigint not null references public.books (id) on delete restrict,
  member_id uuid not null references public.users (id) on delete restrict,
  checked_out_at timestamptz not null default now(),
  due_at timestamptz not null,
  checked_in_at timestamptz,
  fine_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checked_in_after_out check (checked_in_at is null or checked_in_at >= checked_out_at)
);

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create index if not exists idx_transactions_member_out on public.transactions (member_id, checked_out_at desc);
create index if not exists idx_transactions_book_out on public.transactions (book_id, checked_out_at desc);
create index if not exists idx_transactions_due_at on public.transactions (due_at);

-- 4) Helper predicate used in policies
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

-- 5) RLS
alter table public.users enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.transactions enable row level security;

-- users: self access + admin access
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Admins can view all profiles" on public.users;
create policy "Admins can view all profiles"
on public.users
for select
to authenticated
using (public.is_admin());

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can update profiles" on public.users;
create policy "Admins can update profiles"
on public.users
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- admin_allowlist: only admins can manage
drop policy if exists "Admins can view admin allowlist" on public.admin_allowlist;
create policy "Admins can view admin allowlist"
on public.admin_allowlist
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can manage admin allowlist" on public.admin_allowlist;
create policy "Admins can manage admin allowlist"
on public.admin_allowlist
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- audit_logs: admins can read (writes expected via service role)
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_admin());

-- categories: public read, admin write
drop policy if exists "Categories are viewable by anyone" on public.categories;
create policy "Categories are viewable by anyone"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- books: public read, admin write
drop policy if exists "Books are viewable by anyone" on public.books;
create policy "Books are viewable by anyone"
on public.books
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage books" on public.books;
create policy "Admins can manage books"
on public.books
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- transactions: members read own, admin read all; insert/update limited
drop policy if exists "Members can view own transactions" on public.transactions;
create policy "Members can view own transactions"
on public.transactions
for select
to authenticated
using (member_id = auth.uid());

drop policy if exists "Admins can view all transactions" on public.transactions;
create policy "Admins can view all transactions"
on public.transactions
for select
to authenticated
using (public.is_admin());

drop policy if exists "Members can create own transactions" on public.transactions;
create policy "Members can create own transactions"
on public.transactions
for insert
to authenticated
with check (member_id = auth.uid());

drop policy if exists "Admins can create transactions" on public.transactions;
create policy "Admins can create transactions"
on public.transactions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Members can update own transactions" on public.transactions;
create policy "Members can update own transactions"
on public.transactions
for update
to authenticated
using (member_id = auth.uid())
with check (member_id = auth.uid());

drop policy if exists "Admins can update transactions" on public.transactions;
create policy "Admins can update transactions"
on public.transactions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 6) RPC: atomic checkout / checkin (recommended for concurrency safety)
create or replace function public.checkout_book(
  p_book_id bigint,
  p_member_id uuid,
  p_loan_days integer default 14
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
  v_tx public.transactions;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if not public.is_admin() and p_member_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_loan_days is null or p_loan_days < 1 or p_loan_days > 60 then
    raise exception 'invalid loan_days';
  end if;

  select * into v_book
  from public.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'book not found';
  end if;

  if v_book.stock_available <= 0 then
    raise exception 'book out of stock';
  end if;

  update public.books
  set stock_available = stock_available - 1
  where id = p_book_id;

  insert into public.transactions (book_id, member_id, checked_out_at, due_at)
  values (p_book_id, p_member_id, now(), now() + (p_loan_days * interval '1 day'))
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function public.checkin_book(
  p_transaction_id bigint,
  p_daily_fine numeric default 0.50
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions;
  v_overdue_days integer;
  v_fine numeric(10,2);
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if p_daily_fine is null or p_daily_fine < 0 then
    raise exception 'invalid daily fine';
  end if;

  select * into v_tx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;

  if v_tx.checked_in_at is not null then
    raise exception 'already checked in';
  end if;

  if not public.is_admin() and v_tx.member_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  v_overdue_days := greatest(0, (current_date - (v_tx.due_at::date)));
  v_fine := round((v_overdue_days * p_daily_fine)::numeric, 2);

  update public.transactions
  set checked_in_at = now(),
      fine_amount = v_fine
  where id = p_transaction_id
  returning * into v_tx;

  update public.books
  set stock_available = stock_available + 1
  where id = v_tx.book_id;

  return v_tx;
end;
$$;

-- Allow only authenticated users to execute lending RPCs.
revoke execute on function public.checkout_book(bigint, uuid, integer) from public;
revoke execute on function public.checkin_book(bigint, numeric) from public;
grant execute on function public.checkout_book(bigint, uuid, integer) to authenticated;
grant execute on function public.checkin_book(bigint, numeric) to authenticated;

-- 7) RPC: Top borrowed books in a range (used for "5 buku paling sering dipinjam bulan ini")
create or replace function public.top_borrowed_books(
  p_from date,
  p_to date,
  p_limit integer default 5
)
returns table (
  book_id bigint,
  title text,
  author text,
  borrow_count bigint
)
language sql
stable
as $$
  select
    b.id as book_id,
    b.title,
    b.author,
    count(*)::bigint as borrow_count
  from public.transactions t
  join public.books b on b.id = t.book_id
  where t.checked_out_at >= p_from::timestamptz
    and t.checked_out_at < p_to::timestamptz
  group by b.id, b.title, b.author
  order by borrow_count desc, b.title asc
  limit greatest(1, p_limit);
$$;

revoke execute on function public.top_borrowed_books(date, date, integer) from public;
grant execute on function public.top_borrowed_books(date, date, integer) to authenticated;
