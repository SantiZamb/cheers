-- Cheers: initial schema.
-- Every table has row-level security. Visibility model:
--   * profiles and the beer catalog are readable by any signed-in user (needed to find friends / beers)
--   * posts, reactions and comments are visible to the author and their accepted friends
--   * challenges are visible to their participants (invited or joined)
--   * locations are visible to friends only while sharing is on

-- ───────────────────────── Profiles ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  name text not null default '' check (char_length(name) <= 40),
  city text not null default '' check (char_length(city) <= 60),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create a profile row for every new auth user, with a generated username.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := left(regexp_replace(lower(split_part(coalesce(new.email, 'cheers'), '@', 1)), '[^a-z0-9_]', '', 'g'), 18);
begin
  if char_length(base) < 3 then
    base := 'cheers';
  end if;
  insert into public.profiles (id, username)
  values (new.id, base || '_' || substr(md5(random()::text), 1, 4));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Friendships ─────────────────────────

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- One friendship per pair, whoever asked first.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "See your own friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "Send friend requests"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "Accept requests sent to you"
  on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');

create policy "Either side can remove a friendship"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- ───────────────────────── Beers ─────────────────────────

create table public.beers (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  brewery text not null default 'Unknown brewery',
  style text not null default 'Beer',
  abv numeric(4, 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.beers enable row level security;

create policy "Beers are readable by signed-in users"
  on public.beers for select to authenticated using (true);

create policy "Users add custom beers"
  on public.beers for insert to authenticated
  with check (created_by = (select auth.uid()) and id like 'custom-%');

-- ───────────────────────── Posts, reactions, comments ─────────────────────────

create table public.posts (
  -- Clients may supply the id so optimistic updates can reference the post before it's saved.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('beer', 'night', 'checkin')),
  beer_id text references public.beers (id),
  rating smallint check (rating between 1 and 5),
  title text check (char_length(title) <= 80),
  beers_count smallint check (beers_count between 0 and 50),
  venue text check (char_length(venue) <= 80),
  city text not null default '',
  note text not null default '' check (char_length(note) <= 500),
  photo_path text,
  created_at timestamptz not null default now(),
  check (kind <> 'beer' or beer_id is not null)
);

create index posts_user_created_idx on public.posts (user_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

create function public.can_see_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid() or public.are_friends(auth.uid(), target);
$$;

create function public.can_see_post(post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.posts p where p.id = post and public.can_see_user(p.user_id));
$$;

create policy "See your own and your friends' posts"
  on public.posts for select to authenticated
  using (public.can_see_user(user_id));

create policy "Create your own posts"
  on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Delete your own posts"
  on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🍻', '🔥', '😂', '🤤')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table public.reactions enable row level security;

create policy "See reactions on posts you can see"
  on public.reactions for select to authenticated
  using (public.can_see_post(post_id));

create policy "React to posts you can see"
  on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see_post(post_id));

create policy "Remove your own reactions"
  on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "See comments on posts you can see"
  on public.comments for select to authenticated
  using (public.can_see_post(post_id));

create policy "Comment on posts you can see"
  on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_see_post(post_id));

create policy "Delete your own comments"
  on public.comments for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────── Challenges ─────────────────────────

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null check (kind in ('newBeers', 'nights', 'topRated', 'cities')),
  goal int not null check (goal between 1 and 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  badge_emoji text not null,
  badge_name text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('invited', 'joined')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index challenge_participants_user_idx on public.challenge_participants (user_id);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

create function public.is_participant(challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = challenge and cp.user_id = auth.uid()
  );
$$;

create policy "Participants see their challenges"
  on public.challenges for select to authenticated
  using (public.is_participant(id));

create policy "Participants see each other"
  on public.challenge_participants for select to authenticated
  using (public.is_participant(challenge_id));

create policy "Accept your own invite"
  on public.challenge_participants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'joined');

create policy "Leave a challenge"
  on public.challenge_participants for delete to authenticated
  using (user_id = (select auth.uid()));

-- Creating a challenge and inviting friends happens atomically through this function
-- (the creator must be a participant before RLS lets them see the challenge).
create function public.create_challenge(
  p_title text,
  p_description text,
  p_kind text,
  p_goal int,
  p_days int,
  p_badge_emoji text,
  p_badge_name text,
  p_invitee_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  invitee uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_days not between 1 and 31 then
    raise exception 'Challenges last 1 to 31 days';
  end if;

  insert into public.challenges (created_by, title, description, kind, goal, starts_at, ends_at, badge_emoji, badge_name)
  values (me, p_title, p_description, p_kind, p_goal, now(), now() + make_interval(days => p_days), p_badge_emoji, p_badge_name)
  returning id into new_id;

  insert into public.challenge_participants (challenge_id, user_id, status)
  values (new_id, me, 'joined');

  foreach invitee in array coalesce(p_invitee_ids, '{}') loop
    if invitee <> me and public.are_friends(me, invitee) then
      insert into public.challenge_participants (challenge_id, user_id, status, invited_by)
      values (new_id, invitee, 'invited', me)
      on conflict do nothing;
    end if;
  end loop;

  return new_id;
end;
$$;

-- Leaderboard and recap for a challenge, computed over joined participants' posts inside the
-- challenge window. Security definer so standings include participants who aren't your friends.
create function public.challenge_summary(p_challenge uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  result jsonb;
begin
  if not public.is_participant(p_challenge) then
    raise exception 'Not a participant';
  end if;
  select * into c from public.challenges where id = p_challenge;

  with members as (
    select cp.user_id from public.challenge_participants cp
    where cp.challenge_id = p_challenge and cp.status = 'joined'
  ),
  window_posts as (
    select p.*, b.name as beer_name
    from public.posts p
    join members m on m.user_id = p.user_id
    left join public.beers b on b.id = p.beer_id
    where p.created_at >= c.starts_at and p.created_at < c.ends_at
  ),
  standings as (
    select
      m.user_id,
      case c.kind
        when 'newBeers' then (select count(distinct wp.beer_id) from window_posts wp where wp.user_id = m.user_id and wp.kind = 'beer')
        when 'nights' then (select count(*) from window_posts wp where wp.user_id = m.user_id and wp.kind = 'night')
        when 'topRated' then coalesce((select max(wp.rating) from window_posts wp where wp.user_id = m.user_id and wp.kind = 'beer'), 0)
        when 'cities' then (select count(distinct wp.city) from window_posts wp where wp.user_id = m.user_id and wp.city <> '')
      end as value,
      case when c.kind = 'topRated' then (
        select wp.beer_name from window_posts wp
        where wp.user_id = m.user_id and wp.kind = 'beer'
        order by wp.rating desc nulls last, wp.created_at limit 1
      ) end as detail,
      (select count(*) from window_posts wp where wp.user_id = m.user_id) as post_count
    from members m
  )
  select jsonb_build_object(
    'standings', coalesce((select jsonb_agg(jsonb_build_object('userId', s.user_id, 'value', s.value, 'detail', s.detail, 'posts', s.post_count) order by s.value desc) from standings s), '[]'::jsonb),
    'groupCities', (select coalesce(jsonb_agg(distinct wp.city), '[]'::jsonb) from window_posts wp where wp.city <> ''),
    'posts', (select count(*) from window_posts),
    'beers', (select count(distinct wp.beer_id) from window_posts wp where wp.beer_id is not null)
  ) into result;

  return result;
end;
$$;

-- ───────────────────────── Location sharing ─────────────────────────

create table public.locations (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  sharing text not null default 'off' check (sharing in ('off', 'city', 'precise')),
  -- In 'city' mode the client rounds coordinates (~10 km) before uploading; in 'off' mode it clears them.
  lat double precision,
  lng double precision,
  city text,
  updated_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create policy "See your own location and friends who share"
  on public.locations for select to authenticated
  using (user_id = (select auth.uid()) or (sharing <> 'off' and public.are_friends((select auth.uid()), user_id)));

create policy "Insert your own location"
  on public.locations for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update your own location"
  on public.locations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───────────────────────── Storage ─────────────────────────
-- avatars: public (profile photos are visible to every signed-in user anyway).
-- post-photos: private; friends read them through signed URLs.
-- Uploads go into a folder named after the uploader's user id.

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true), ('post-photos', 'post-photos', false);

create policy "Read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "Upload to your own avatar folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Replace your own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Upload your own post photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Read post photos of yourself and friends"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-photos' and public.can_see_user(((storage.foldername(name))[1])::uuid));

create policy "Delete your own post photos"
  on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'post-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ───────────────────────── Realtime ─────────────────────────
-- Clients subscribe to these to refresh caches and show "Maya reacted…" banners (RLS applies).

alter publication supabase_realtime add table public.posts, public.reactions, public.comments, public.friendships, public.challenge_participants;
