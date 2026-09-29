-- Groups get their own tab (challenges are hidden in the app for now), so:
--  * the group's creator can remove people (anyone can still leave on their own). If the
--    creator has left, any member can remove others so the group is never stuck.
--  * "added you to a group" pushes open the Groups tab.

create function public.remove_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  creator uuid;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Not a member of this group';
  end if;
  select g.created_by into creator from public.groups g where g.id = p_group;
  if p_user <> me
     and creator is distinct from me
     and exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.user_id = creator) then
    raise exception 'Only the group’s creator can remove people';
  end if;
  delete from public.group_members gm where gm.group_id = p_group and gm.user_id = p_user;
end;
$$;

create or replace function public.notify_group_added()
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
      '/groups/' || new.group_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_group_added() from public, anon, authenticated;
