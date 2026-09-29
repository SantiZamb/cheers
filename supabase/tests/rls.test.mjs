// Row-level-security and trigger tests for supabase/migrations, run against PGlite (real Postgres
// in-process) with small stand-ins for Supabase's auth, storage, realtime and pg_net pieces.
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../migrations', import.meta.url).pathname;
const db = new PGlite();

// Minimal stand-ins for what Supabase provides (auth, storage, realtime, pg_net, roles, grants).
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage; create schema extensions; create schema net;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create table net.log (url text, body jsonb);
  create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.log values (url, body); select 1::bigint $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage, net, extensions to anon, authenticated;
  grant all on storage.objects to authenticated;
  grant execute on function auth.uid() to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

for (const file of readdirSync(MIGRATIONS).sort()) {
  const sql = readFileSync(`${MIGRATIONS}/${file}`, 'utf8').replace(/create extension if not exists pg_net[^;]*;/, '');
  try {
    await db.exec(sql);
    console.log(`✓ migration ${file}`);
  } catch (e) {
    console.log(`✗ migration ${file}: ${e.message}`);
    process.exit(1);
  }
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users values ('${A}', 'alice.smith@example.com'), ('${B}', 'bob@example.com'), ('${C}', 'x@example.com')`);

let failures = 0;
async function as(uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` (${detail})` : ''}`);
}
async function expectError(name, fn) {
  try {
    await fn();
    check(name, false, 'no error');
  } catch (e) {
    check(name, true, e.message.slice(0, 60));
  }
}
const rows = async (uid, sql, params) => (await as(uid, sql, params)).rows;

// Profiles
const profiles = await rows(A, `select id, username from profiles order by username`);
check('profiles auto-created with usernames', profiles.length === 3, profiles.map((p) => p.username).join(', '));
await as(A, `update profiles set name = 'Alice', city = 'Chicago' where id = $1`, [A]);
await as(B, `update profiles set name = 'Bob' where id = $1`, [A]);
check('cannot edit someone else’s profile', (await rows(A, `select name from profiles where id = $1`, [A]))[0].name === 'Alice');

// Posts before friendship
const postId = (await as(A, `insert into posts (kind, beer_id, rating, city) values ('beer', 'fat-tire', 4, 'Chicago') returning id`)).rows[0].id;
check('A sees own post', (await rows(A, `select id from posts`)).length === 1);
check('B cannot see A’s post before friendship', (await rows(B, `select id from posts`)).length === 0);
await expectError('cannot post as someone else', () => as(B, `insert into posts (user_id, kind, note) values ($1, 'checkin', 'hi')`, [A]));
await expectError('beer post requires a beer', () => as(A, `insert into posts (kind) values ('beer')`));

// Friendship flow
await as(A, `insert into push_tokens (token) values ('ExponentPushToken[alice]')`);
await as(B, `insert into push_tokens (token) values ('ExponentPushToken[bob]')`);
check('push tokens are private', (await rows(B, `select * from push_tokens`)).length === 1);
await as(A, `insert into friendships (requester_id, addressee_id) values ($1, $2)`, [A, B]);
await expectError('no duplicate reverse request', () => as(B, `insert into friendships (requester_id, addressee_id) values ($1, $2)`, [B, A]));
await as(A, `update friendships set status = 'accepted' where requester_id = $1`, [A]);
check('requester cannot accept own request', (await rows(A, `select status from friendships`))[0].status === 'pending');
check('C cannot see A↔B friendship', (await rows(C, `select * from friendships`)).length === 0);
await as(B, `update friendships set status = 'accepted' where addressee_id = $1`, [B]);
check('B accepted', (await rows(B, `select status from friendships`))[0].status === 'accepted');
check('B now sees A’s post', (await rows(B, `select id from posts`)).length === 1);
check('C still cannot', (await rows(C, `select id from posts`)).length === 0);

// Reactions and comments
await as(B, `insert into reactions (post_id, emoji) values ($1, '🍻')`, [postId]);
await as(B, `insert into comments (post_id, text) values ($1, 'Nice!')`, [postId]);
await expectError('C cannot react to a post it can’t see', () => as(C, `insert into reactions (post_id, emoji) values ($1, '🔥')`, [postId]));
await expectError('only the 4 reaction emoji', () => as(B, `insert into reactions (post_id, emoji) values ($1, '💩')`, [postId]));
check('A sees reaction + comment', (await rows(A, `select * from reactions`)).length === 1 && (await rows(A, `select * from comments`)).length === 1);
check('C sees no comments', (await rows(C, `select * from comments`)).length === 0);

// Custom beers
await as(A, `insert into beers (id, name, created_by) values ('custom-zombiedust', 'Zombie Dust', $1)`, [A]);
await expectError('cannot overwrite catalog ids', () => as(A, `insert into beers (id, name, created_by) values ('my-beer', 'X', $1)`, [A]));
check('catalog seeded', (await rows(C, `select count(*)::int as n from beers`))[0].n === 28);

// Challenges
const chId = (await as(A, `select create_challenge('Three new beers', 'desc', 'newBeers', 3, 7, '🧭', 'Beer Explorer', $1) as id`, [[B, C]])).rows[0].id;
const parts = await rows(A, `select user_id, status from challenge_participants order by status`);
check('creator joined, friend invited, non-friend skipped', parts.length === 2, parts.map((p) => p.status).join(','));
check('invitee sees challenge', (await rows(B, `select id from challenges`)).length === 1);
check('non-participant does not', (await rows(C, `select id from challenges`)).length === 0);
await as(B, `update challenge_participants set status = 'joined' where user_id = $1`, [B]);
await as(B, `insert into posts (kind, beer_id, city) values ('beer', 'guinness-draught', 'Dublin'), ('beer', 'duvel', 'Dublin')`);
const summary = (await rows(A, `select challenge_summary($1) as s`, [chId]))[0].s;
check('summary standings', summary.standings.length === 2 && summary.standings[0].value === 2, JSON.stringify(summary.standings.map((s) => s.value)));
check('summary counts only posts inside the challenge window', summary.posts === 2 && summary.beers === 2, `posts=${summary.posts} beers=${summary.beers}`);
await expectError('non-participant cannot read summary', () => as(C, `select challenge_summary($1)`, [chId]));
await expectError('cannot call send_push directly', () => as(A, `select send_push($1, 'x', 'y', '/')`, [B]));

// Tutorial
check('new sign-ups have not seen the tutorial', (await rows(A, `select tutorial_seen from profiles where id = $1`, [A]))[0].tutorial_seen === false);
await as(A, `update profiles set tutorial_seen = true where id = $1`, [A]);
check('users mark the tutorial seen', (await rows(A, `select tutorial_seen from profiles where id = $1`, [A]))[0].tutorial_seen === true);

// Groups
const groupId = (await as(A, `select create_group('Tuesday Crew', $1) as id`, [[B, C]])).rows[0].id;
const groupMembers = await rows(A, `select user_id from group_members where group_id = $1`, [groupId]);
check('group: creator + friend added, non-friend skipped', groupMembers.length === 2, `${groupMembers.length}`);
check('member sees the group', (await rows(B, `select id from groups`)).length === 1);
check('non-member does not', (await rows(C, `select id from groups`)).length === 0 && (await rows(C, `select * from group_members`)).length === 0);
await expectError('cannot insert into groups directly', () => as(C, `insert into groups (name) values ('Sneaky')`));
await expectError('cannot join a group directly', () => as(C, `insert into group_members (group_id, user_id) values ($1, $2)`, [groupId, C]));
await expectError('non-member cannot add members', () => as(C, `select add_group_members($1, $2)`, [groupId, [C]]));
await as(B, `update groups set name = 'Tuesday Legends' where id = $1`, [groupId]);
check('members can rename', (await rows(A, `select name from groups`))[0].name === 'Tuesday Legends');
await as(C, `update groups set name = 'Hacked' where id = $1`, [groupId]);
check('non-members cannot rename', (await rows(A, `select name from groups`))[0].name === 'Tuesday Legends');
await expectError('members cannot change the creator', () => as(B, `update groups set created_by = $2 where id = $1`, [groupId, B]));
await as(B, `insert into posts (kind, title, beers_count, rating, city) values ('night', 'Big one', 4, 5, 'Chicago')`);
await as(A, `insert into reactions (post_id, emoji) select id, '🔥' from posts where user_id = $1 and kind = 'night'`, [B]);
const board = (await rows(A, `select group_leaderboard($1) as b`, [groupId]))[0].b;
const bob = board.standings.find((s) => s.userId === B);
check('leaderboard: beers count check-ins + night beers', bob.beers === 6 && bob.posts === 3 && bob.nights === 1, JSON.stringify(bob));
check('leaderboard: unique beers, cheers, avg rating', bob.uniqueBeers === 2 && bob.cheers === 1 && Number(bob.avgRating) === 5, JSON.stringify(bob));
check('leaderboard: period filter', (await rows(A, `select group_leaderboard($1, now() + interval '1 day') as b`, [groupId]))[0].b.posts === 0);
await expectError('non-member cannot read the leaderboard', () => as(C, `select group_leaderboard($1)`, [groupId]));
await as(B, `delete from group_members where group_id = $1 and user_id = $2`, [groupId, A]);
check('cannot remove someone else', (await rows(A, `select * from group_members`)).length === 2);
await as(B, `delete from group_members where user_id = $1`, [B]);
check('members can leave', (await rows(A, `select * from group_members`)).length === 1);
await as(A, `delete from group_members where user_id = $1`, [A]);
check('empty group is deleted', (await db.query(`select * from groups`)).rows.length === 0);

// Locations
await as(A, `insert into locations (sharing, lat, lng, city) values ('precise', 41.88, -87.63, 'Chicago')`);
check('friend sees shared location', (await rows(B, `select * from locations`)).length === 1);
check('non-friend does not', (await rows(C, `select * from locations`)).length === 0);
await as(A, `update locations set sharing = 'off', lat = null, lng = null`);
check('sharing off hides it', (await rows(B, `select * from locations`)).length === 0);

// Storage
await as(A, `insert into storage.objects (bucket_id, name) values ('post-photos', '${A}/p1.jpg')`);
await expectError('cannot upload into another user’s folder', () => as(C, `insert into storage.objects (bucket_id, name) values ('post-photos', '${A}/evil.jpg')`));
check('friend can read post photo', (await rows(B, `select name from storage.objects where bucket_id = 'post-photos'`)).length === 1);
check('non-friend cannot', (await rows(C, `select name from storage.objects where bucket_id = 'post-photos'`)).length === 0);

// Pushes
const pushes = (await db.query(`select body->>'to' as to, body->>'title' as title from net.log`)).rows;
console.log('  pushes sent:', pushes.map((p) => `${p.to.match(/\[(\w+)\]/)[1]}: ${p.title}`).join(' | '));
check('pushes for request, accept, reactions, comment, invite, group add, friend posts', pushes.length === 10, `${pushes.length}`);
check('nobody is pushed about their own action', !pushes.some((p) => p.title.startsWith('Alice') && p.to.includes('alice')));

console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
