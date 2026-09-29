-- Groups: a named crew of friends with a photo and a leaderboard.
-- Visibility: groups and their member lists are visible to members only. Anyone can create a
-- group with their friends; members can rename it, change its photo and add their own friends;
-- anyone can leave. The leaderboard is a security-definer RPC so it can count posts of members
-- who aren't your friends (aggregate numbers only, like challenge_summary).
--
-- Also: profiles.tutorial_seen, so the intro tutorial shows once, after sign-up.

-- ───────────────────────── Tutorial ─────────────────────────

alter table public.profiles add column tutorial_seen boolean not null default false;
-- People who signed up before the tutorial existed already know their way around.
update public.profiles set tutorial_seen = true;

-- ───────────────────────── Groups ─────────────────────────

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  -- In the public avatars bucket, under the uploader's folder.
  photo_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create function public.is_group_member(grp uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = grp and gm.user_id = auth.uid()
  );
$$;

create policy "Members see their groups"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "Members edit their groups"
  on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));

-- Members may change only the name and photo.
revoke update on public.groups from anon, authenticated;
grant update (name, photo_path) on public.groups to authenticated;

create policy "Members see each other"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "Leave a group"
  on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- Creating a group and adding members happens through these functions: the creator must be a
-- member before RLS lets them see the group, and only friends of whoever adds them may be added.
create function public.add_group_members(p_group uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  member uuid;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group';
  end if;
  foreach member in array coalesce(p_member_ids, '{}') loop
    if member <> me and public.are_friends(me, member) then
      insert into public.group_members (group_id, user_id, added_by)
      values (p_group, member, me)
      on conflict do nothing;
    end if;
  end loop;
  if (select count(*) from public.group_members gm where gm.group_id = p_group) > 50 then
    raise exception 'Groups have at most 50 members';
  end if;
end;
$$;

create function public.create_group(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  insert into public.groups (name, created_by) values (trim(p_name), me) returning id into new_id;
  insert into public.group_members (group_id, user_id, added_by) values (new_id, me, me);
  perform public.add_group_members(new_id, p_member_ids);
  return new_id;
end;
$$;

-- The last one out turns off the lights.
create function public.delete_empty_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.groups g
  where g.id = old.group_id
    and not exists (select 1 from public.group_members gm where gm.group_id = old.group_id);
  return old;
end;
$$;

create trigger delete_empty_group after delete on public.group_members
  for each row execute function public.delete_empty_group();

-- Leaderboard: per-member stats over posts since p_since (null = all time).
--   beers: beer check-ins plus the beers counted on night-out posts
create function public.group_leaderboard(p_group uuid, p_since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group';
  end if;

  with members as (
    select gm.user_id from public.group_members gm where gm.group_id = p_group
  ),
  window_posts as (
    select p.* from public.posts p
    join members m on m.user_id = p.user_id
    where p_since is null or p.created_at >= p_since
  ),
  standings as (
    select
      m.user_id,
      (select count(*) filter (where wp.kind = 'beer') + coalesce(sum(wp.beers_count) filter (where wp.kind = 'night'), 0)
         from window_posts wp where wp.user_id = m.user_id) as beers,
      (select count(distinct wp.beer_id) from window_posts wp where wp.user_id = m.user_id and wp.beer_id is not null) as unique_beers,
      (select count(*) from window_posts wp where wp.user_id = m.user_id) as posts,
      (select count(*) from window_posts wp where wp.user_id = m.user_id and wp.kind = 'night') as nights,
      (select round(avg(wp.rating)::numeric, 1) from window_posts wp where wp.user_id = m.user_id and wp.rating is not null) as avg_rating,
      (select count(*) from public.reactions r join window_posts wp on wp.id = r.post_id
         where wp.user_id = m.user_id and r.user_id <> m.user_id) as cheers
    from members m
  )
  select jsonb_build_object(
    'standings', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', s.user_id,
      'beers', s.beers,
      'uniqueBeers', s.unique_beers,
      'posts', s.posts,
      'nights', s.nights,
      'avgRating', s.avg_rating,
      'cheers', s.cheers
    )) from standings s), '[]'::jsonb),
    'posts', (select count(*) from window_posts),
    'beers', (select coalesce(sum(s.beers), 0) from standings s),
    'cities', (select count(distinct wp.city) from window_posts wp where wp.city <> '')
  ) into result;

  return result;
end;
$$;

-- ───────────────────────── Push ─────────────────────────

create function public.notify_group_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.added_by is distinct from new.user_id then
    perform public.send_push(
      new.user_id,
      public.display_name(new.added_by) || ' added you to a group',
      (select g.name from public.groups g where g.id = new.group_id),
      '/challenges'
    );
  end if;
  return new;
end;
$$;

create trigger push_on_group_added after insert on public.group_members
  for each row execute function public.notify_group_added();

revoke execute on function public.notify_group_added() from public, anon, authenticated;
revoke execute on function public.delete_empty_group() from public, anon, authenticated;

-- ───────────────────────── Realtime ─────────────────────────

alter publication supabase_realtime add table public.groups, public.group_members;
