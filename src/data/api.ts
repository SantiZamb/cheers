import { File } from 'expo-file-system';

import { BEER_CATALOG, type Beer } from '@/data/beers';
import type {
  Group,
  GroupLeaderboard,
  GroupPeriod,
  LocationSharing,
  MyLocation,
  Post,
  PostKind,
  Reaction,
  User,
} from '@/data/types';
import { avatarUrl, AVATARS_BUCKET, POST_PHOTOS_BUCKET, supabase } from '@/lib/supabase';

/**
 * All Supabase reads and writes. Rows are mapped to the app's own types (src/data/types.ts)
 * so screens don't care where data came from. Security is enforced by row-level security in
 * the database (supabase/migrations), not here.
 */

const PHOTO_URL_TTL = 7 * 24 * 60 * 60; // seconds; matches the local cache lifetime

type ProfileRow = { id: string; username: string; name: string; city: string; avatar_path: string | null };
const PROFILE_COLUMNS = 'id, username, name, city, avatar_path';

export function toUser(row: ProfileRow, location?: { lat: number | null; lng: number | null }): User {
  return {
    id: row.id,
    name: row.name || row.username,
    username: row.username,
    city: row.city,
    photo: avatarUrl(row.avatar_path),
    lat: location?.lat ?? undefined,
    lng: location?.lng ?? undefined,
  };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

async function readBytes(localUri: string) {
  return new File(localUri).arrayBuffer();
}

// ───────────── Profiles ─────────────

/** Your own profile, plus fields only you need. */
export type MyProfileRow = ProfileRow & { tutorial_seen: boolean };

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`${PROFILE_COLUMNS}, tutorial_seen`)
    .eq('id', userId)
    .single();
  fail(error);
  return data as MyProfileRow;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<MyProfileRow, 'name' | 'city' | 'avatar_path' | 'tutorial_seen'>>
) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  fail(error);
}

/** Uploads a new profile photo and points the profile at it. Returns the storage path. */
export async function uploadAvatar(userId: string, localUri: string) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, await readBytes(localUri), { contentType: 'image/jpeg' });
  fail(error);
  await updateProfile(userId, { avatar_path: path });
  return path;
}

export async function searchProfiles(query: string, myId: string): Promise<User[]> {
  const q = query.trim().replace(/[%_,()]/g, '');
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .or(`name.ilike.%${q}%,username.ilike.%${q}%,city.ilike.%${q}%`)
    .neq('id', myId)
    .limit(20);
  fail(error);
  return (data as ProfileRow[]).map((row) => toUser(row));
}

// ───────────── Friends ─────────────

export type Friendships = { friends: User[]; incoming: User[]; outgoing: User[] };

export async function fetchFriendships(myId: string): Promise<Friendships> {
  const [{ data, error }, locations] = await Promise.all([
    supabase
      .from('friendships')
      .select(
        `requester_id, addressee_id, status,
         requester:profiles!friendships_requester_id_fkey(${PROFILE_COLUMNS}),
         addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLUMNS})`
      ),
    fetchFriendLocations(),
  ]);
  fail(error);

  const result: Friendships = { friends: [], incoming: [], outgoing: [] };
  for (const row of (data ?? []) as unknown as {
    requester_id: string;
    status: string;
    requester: ProfileRow;
    addressee: ProfileRow;
  }[]) {
    const iAsked = row.requester_id === myId;
    const other = iAsked ? row.addressee : row.requester;
    const user = toUser(other, locations.get(other.id));
    if (row.status === 'accepted') result.friends.push(user);
    else if (iAsked) result.outgoing.push(user);
    else result.incoming.push(user);
  }
  return result;
}

export async function sendFriendRequest(myId: string, otherId: string) {
  const { error } = await supabase.from('friendships').insert({ requester_id: myId, addressee_id: otherId });
  fail(error);
}

export async function acceptFriendRequest(myId: string, requesterId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester_id', requesterId)
    .eq('addressee_id', myId);
  fail(error);
}

export async function removeFriendship(myId: string, otherId: string) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`);
  fail(error);
}

// ───────────── Beers ─────────────

export async function fetchBeers(): Promise<Beer[]> {
  const { data, error } = await supabase.from('beers').select('id, name, brewery, style, abv');
  fail(error);
  return (data ?? []).map((b) => ({ ...b, abv: b.abv == null ? undefined : Number(b.abv) }));
}

export const catalogFallback: Beer[] = BEER_CATALOG;

export async function ensureCustomBeer(myId: string, beer: Beer) {
  const { error } = await supabase
    .from('beers')
    .upsert({ id: beer.id, name: beer.name, created_by: myId }, { onConflict: 'id', ignoreDuplicates: true });
  fail(error);
}

// ───────────── Posts ─────────────

type PostRow = {
  id: string;
  user_id: string;
  kind: PostKind;
  beer_id: string | null;
  rating: number | null;
  title: string | null;
  beers_count: number | null;
  venue: string | null;
  city: string;
  note: string;
  photo_path: string | null;
  created_at: string;
  beer: { name: string; brewery: string; style: string } | null;
  reactions: { emoji: Reaction; user_id: string }[];
  comments: { id: string; user_id: string; text: string; created_at: string; author: ProfileRow }[];
};

/** Recent posts from you and your friends (RLS decides visibility), plus any comment authors. */
export async function fetchPosts(): Promise<{ posts: Post[]; commentAuthors: User[] }> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, user_id, kind, beer_id, rating, title, beers_count, venue, city, note, photo_path, created_at,
       beer:beers(name, brewery, style),
       reactions(emoji, user_id),
       comments(id, user_id, text, created_at, author:profiles!comments_user_id_fkey(${PROFILE_COLUMNS}))`
    )
    .order('created_at', { ascending: false })
    .limit(400);
  fail(error);
  const rows = (data ?? []) as unknown as PostRow[];

  // Post photos are private: sign them all in one request.
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from(POST_PHOTOS_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const authors = new Map<string, User>();
  const posts = rows.map((r): Post => {
    const reactions: Post['reactions'] = {};
    for (const x of r.reactions) (reactions[x.emoji] ??= []).push(x.user_id);
    for (const c of r.comments) if (c.author) authors.set(c.author.id, toUser(c.author));
    return {
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      createdAt: Date.parse(r.created_at),
      photo: r.photo_path ? signed.get(r.photo_path) : undefined,
      photoKey: r.photo_path ?? undefined,
      rating: r.rating ?? undefined,
      beerId: r.beer_id ?? undefined,
      beer: r.beer?.name,
      brewery: r.beer?.brewery,
      style: r.beer?.style,
      title: r.title ?? undefined,
      beersCount: r.beers_count ?? undefined,
      venue: r.venue ?? undefined,
      city: r.city,
      note: r.note,
      reactions,
      comments: r.comments
        .map((c) => ({ id: c.id, userId: c.user_id, text: c.text, createdAt: Date.parse(c.created_at) }))
        .sort((a, b) => a.createdAt - b.createdAt),
    };
  });
  return { posts, commentAuthors: [...authors.values()] };
}

export async function createPost(post: Post, localPhoto?: string) {
  let photoPath: string | null = null;
  if (localPhoto) {
    photoPath = `${post.userId}/${post.id}.jpg`;
    // Plain insert, not upsert: every post id is new, and upsert would also need an UPDATE
    // policy on post-photos, which the bucket deliberately doesn't have.
    const { error } = await supabase.storage
      .from(POST_PHOTOS_BUCKET)
      .upload(photoPath, await readBytes(localPhoto), { contentType: 'image/jpeg' });
    fail(error);
  }
  const { error } = await supabase.from('posts').insert({
    id: post.id,
    kind: post.kind,
    beer_id: post.beerId ?? null,
    rating: post.rating ?? null,
    title: post.title ?? null,
    beers_count: post.beersCount ?? null,
    venue: post.venue ?? null,
    city: post.city,
    note: post.note,
    photo_path: photoPath,
    created_at: new Date(post.createdAt).toISOString(),
  });
  fail(error);
}

export async function setReaction(postId: string, emoji: Reaction, on: boolean, myId: string) {
  const { error } = on
    ? await supabase.from('reactions').insert({ post_id: postId, emoji })
    : await supabase.from('reactions').delete().match({ post_id: postId, emoji, user_id: myId });
  fail(error);
}

export async function addComment(id: string, postId: string, text: string) {
  const { error } = await supabase.from('comments').insert({ id, post_id: postId, text });
  fail(error);
}

// ───────────── Groups ─────────────

type GroupRow = {
  id: string;
  name: string;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
  members: { user_id: string; created_at: string; profile: ProfileRow }[];
};

export async function fetchGroups(): Promise<{ groups: Group[]; members: User[] }> {
  const { data, error } = await supabase
    .from('groups')
    .select(
      `id, name, photo_path, created_by, created_at,
       members:group_members(user_id, created_at, profile:profiles!group_members_user_id_fkey(${PROFILE_COLUMNS}))`
    )
    .order('created_at', { ascending: false });
  fail(error);

  const members = new Map<string, User>();
  const groups = ((data ?? []) as unknown as GroupRow[]).map((r): Group => {
    for (const m of r.members) if (m.profile) members.set(m.user_id, toUser(m.profile));
    return {
      id: r.id,
      name: r.name,
      photo: avatarUrl(r.photo_path),
      createdBy: r.created_by ?? undefined,
      createdAt: Date.parse(r.created_at),
      memberIds: [...r.members].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => m.user_id),
    };
  });
  return { groups, members: [...members.values()] };
}

/** Creates the group with you and the given friends in it, then uploads its photo. Returns the id. */
export async function createGroup(myId: string, name: string, memberIds: string[], localPhoto?: string) {
  const { data, error } = await supabase.rpc('create_group', { p_name: name, p_member_ids: memberIds });
  fail(error);
  const id = data as string;
  if (localPhoto) await uploadGroupPhoto(myId, id, localPhoto);
  return id;
}

export async function uploadGroupPhoto(myId: string, groupId: string, localUri: string) {
  const path = `${myId}/group-${groupId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, await readBytes(localUri), { contentType: 'image/jpeg' });
  fail(error);
  await updateGroup(groupId, { photo_path: path });
}

export async function updateGroup(groupId: string, patch: Partial<Pick<GroupRow, 'name' | 'photo_path'>>) {
  const { error } = await supabase.from('groups').update(patch).eq('id', groupId);
  fail(error);
}

export async function addGroupMembers(groupId: string, memberIds: string[]) {
  const { error } = await supabase.rpc('add_group_members', { p_group: groupId, p_member_ids: memberIds });
  fail(error);
}

export async function removeGroupMember(groupId: string, userId: string) {
  const { error } = await supabase.rpc('remove_group_member', { p_group: groupId, p_user: userId });
  fail(error);
}

export async function leaveGroup(myId: string, groupId: string) {
  const { error } = await supabase.from('group_members').delete().match({ group_id: groupId, user_id: myId });
  fail(error);
}

const PERIOD_DAYS: Record<GroupPeriod, number | null> = { week: 7, month: 30, all: null };

export async function fetchGroupLeaderboard(groupId: string, period: GroupPeriod): Promise<GroupLeaderboard> {
  const days = PERIOD_DAYS[period];
  const since = days == null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc('group_leaderboard', { p_group: groupId, p_since: since });
  fail(error);
  const board = data as GroupLeaderboard;
  // numeric comes back as a string or number depending on the driver.
  return {
    ...board,
    standings: board.standings.map((s) => ({ ...s, avgRating: s.avgRating == null ? null : Number(s.avgRating) })),
  };
}

// ───────────── Location ─────────────

type LocationRow = { user_id: string; sharing: LocationSharing; lat: number | null; lng: number | null; city: string | null; updated_at: string };

async function fetchFriendLocations() {
  const { data } = await supabase.from('locations').select('user_id, sharing, lat, lng, city, updated_at');
  return new Map(((data ?? []) as LocationRow[]).map((l) => [l.user_id, l]));
}

export async function fetchMyLocation(myId: string) {
  const { data, error } = await supabase.from('locations').select('user_id, sharing, lat, lng, city, updated_at').eq('user_id', myId).maybeSingle();
  fail(error);
  return data as LocationRow | null;
}

/**
 * Publishes what friends may see. Precise coordinates only leave the device in 'precise' mode;
 * 'city' mode rounds to ~10 km; 'off' clears them.
 */
export async function publishLocation(myId: string, sharing: LocationSharing, loc?: MyLocation) {
  const round = (v: number) => Math.round(v * 10) / 10;
  const row = {
    user_id: myId,
    sharing,
    lat: sharing === 'off' || !loc ? null : sharing === 'city' ? round(loc.lat) : loc.lat,
    lng: sharing === 'off' || !loc ? null : sharing === 'city' ? round(loc.lng) : loc.lng,
    city: sharing === 'off' ? null : (loc?.city ?? null),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('locations').upsert(row);
  fail(error);
}

// ───────────── Push ─────────────

export async function savePushToken(myId: string, token: string) {
  const { error } = await supabase.from('push_tokens').upsert({ user_id: myId, token, updated_at: new Date().toISOString() });
  fail(error);
}
