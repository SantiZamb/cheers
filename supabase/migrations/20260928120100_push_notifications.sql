-- Push notifications, sent straight from Postgres to the Expo push service with pg_net
-- whenever something happens that involves a friend. No edge function needed.

create extension if not exists pg_net with schema extensions;

-- Tokens live apart from profiles so other users can't read them.
create table public.push_tokens (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "Manage your own push token"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.send_push(target uuid, title text, body text, route text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  push_token text;
begin
  -- Never notify people about their own actions.
  if target is null or target = auth.uid() then
    return;
  end if;
  select pt.token into push_token from public.push_tokens pt where pt.user_id = target;
  if push_token is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', push_token,
      'title', title,
      'body', body,
      'sound', 'default',
      'data', jsonb_build_object('url', route)
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- Only the triggers below may send pushes.
revoke execute on function public.send_push(uuid, text, text, text) from public, anon, authenticated;

create function public.display_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.name, ''), p.username) from public.profiles p where p.id = uid;
$$;

create function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_push(
    (select p.user_id from public.posts p where p.id = new.post_id),
    public.display_name(new.user_id) || ' reacted ' || new.emoji,
    'Cheers to your post!',
    '/'
  );
  return new;
end;
$$;

create function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_push(
    (select p.user_id from public.posts p where p.id = new.post_id),
    public.display_name(new.user_id) || ' commented',
    left(new.text, 120),
    '/'
  );
  return new;
end;
$$;

create function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  friend uuid;
  what text := case new.kind when 'beer' then 'is drinking' when 'night' then 'posted a night out' else 'checked in' end;
  detail text := coalesce((select b.name from public.beers b where b.id = new.beer_id), new.title, new.venue, new.note, '');
begin
  for friend in
    select case when f.requester_id = new.user_id then f.addressee_id else f.requester_id end
    from public.friendships f
    where f.status = 'accepted' and new.user_id in (f.requester_id, f.addressee_id)
  loop
    perform public.send_push(friend, public.display_name(new.user_id) || ' ' || what, left(detail, 120), '/');
  end loop;
  return new;
end;
$$;

create function public.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.send_push(new.addressee_id, public.display_name(new.requester_id) || ' wants to be friends', 'Open Cheers to accept', '/map');
  elsif new.status = 'accepted' and old.status = 'pending' then
    perform public.send_push(new.requester_id, public.display_name(new.addressee_id) || ' accepted your friend request', 'Cheers! 🍻', '/map');
  end if;
  return new;
end;
$$;

create function public.notify_challenge_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'invited' then
    perform public.send_push(
      new.user_id,
      public.display_name(new.invited_by) || ' invited you to a challenge',
      (select c.title from public.challenges c where c.id = new.challenge_id),
      '/challenges'
    );
  end if;
  return new;
end;
$$;

create trigger push_on_reaction after insert on public.reactions
  for each row execute function public.notify_reaction();
create trigger push_on_comment after insert on public.comments
  for each row execute function public.notify_comment();
create trigger push_on_post after insert on public.posts
  for each row execute function public.notify_new_post();
create trigger push_on_friendship after insert or update on public.friendships
  for each row execute function public.notify_friendship();
create trigger push_on_challenge_invite after insert on public.challenge_participants
  for each row execute function public.notify_challenge_invite();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_reaction() from public, anon, authenticated;
revoke execute on function public.notify_comment() from public, anon, authenticated;
revoke execute on function public.notify_new_post() from public, anon, authenticated;
revoke execute on function public.notify_friendship() from public, anon, authenticated;
revoke execute on function public.notify_challenge_invite() from public, anon, authenticated;
