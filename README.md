# Cheers 🍻

A social app for friends to capture, rate and share their nights out drinking beer, even when they're in different cities.

**Go out → snap it → rate it → share it → friends react → climb your group's leaderboard → go out again.**

Cheers runs on [Supabase](https://supabase.com) (auth, Postgres with row-level security, storage, realtime) with a local cache on the phone, so screens open instantly and your actions show up before the server even answers.

<p>
  <img src="docs/screenshots/feed.jpg" width="200" alt="Feed" />
  <img src="docs/screenshots/bars-nearby.jpg" width="200" alt="Best bars nearby" />
  <img src="docs/screenshots/friends-map-dark.jpg" width="200" alt="Friends map, dark mode" />
  <img src="docs/screenshots/profile-dark.jpg" width="200" alt="Profile, dark mode" />
</p>

## Features

Five screens:

| Screen | What it does |
|---|---|
| **Feed** | Friends' beers, nights out and check-ins. React with 🍻 🔥 😂 🤤, comment inline, pull to refresh for new posts. "Out now" row and a banner showing where you stand in your group. |
| **Map** | **Friends:** see friends around the world, share your own location (off / city only / exact spot), add friends. **Best bars nearby:** pick a radius (500 m – 5 km) and get ranked bars, pubs and clubs with walking time, directions and one-tap check-in. |
| **Share** | Post a 🍺 beer rating (search and select the beer), a 🌙 night-out recap or a 📍 casual check-in, with a photo from the camera or library. |
| **Groups** | Your crews. Create a group with a name, photo and friends; each group has its own page with members, totals (beers, posts, cities) and a leaderboard by beers, posts, nights out, new beers, average rating or cheers received, this week / this month / all time. Edit the name, photo and members any time. |
| **Profile** | Your photo, stats, beer card collection, a page of 30 badges (common to legendary) and a day-by-day history of your beers, nights and photos. |

**Beer cards.** The first time you check in a beer you collect its card. Drinking it again levels the card up: 5 tiers (Bronze, Silver, Gold, Platinum, Legendary) × 5 levels, up to level 25. Each check-in of that beer is +1 level; another beer from the same brewery is +½ level (capped at what you've had of the beer itself).

Rewards are built in: posting, rating, reactions, new cards and badges trigger short animations, haptics and a chime. Friend activity arrives as in-app banners and, when the app is in the background, as local notifications.

## Getting started

**Requirements:** Node 20.19 or newer, a [Supabase](https://supabase.com) project, and the [Expo Go](https://expo.dev/go) app on your phone (or Xcode / Android Studio for simulators).

```bash
npm install
cp .env.example .env.local        # then fill in your project URL and publishable key
npx supabase login                # once
npx supabase link --project-ref <your-project-ref>
npx supabase db push              # creates tables, security rules, storage buckets, beer catalog
npx expo start
```

Scan the QR code with your phone's camera (iOS) or Expo Go (Android), or press `i` / `a` for a simulator. Your phone and computer need to be on the same Wi‑Fi; otherwise use `npx expo start --tunnel`.

Sign-in is email + password. In the Supabase dashboard, **Authentication → Sign In / Providers → Email** has **Confirm email** turned off, so new accounts are signed in immediately without any email.

### Useful commands

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npm run test:db    # database security tests (runs Postgres in-process, no Docker)
npx supabase db push   # apply new migrations
```

## How it works

- **Sign-in** is email + password (8+ characters for new accounts). First launch asks for a name, city and optional photo.
- **Security** lives in the database: row-level security means you only ever receive your own and your accepted friends' posts, reactions, comments and (if they share it) locations. See `supabase/migrations/`.
- **Local caching.** Every query result is cached in SQLite on the phone (TanStack Query) and shown immediately on the next launch while fresh data loads in the background. Posting, reacting, commenting, friend requests and group edits update the screen instantly and sync in the background; if the server rejects a change it's rolled back with a message.
- **Live updates.** Supabase Realtime pushes friends' activity into the app ("Maya reacted 🍻…") and refreshes the cache.
- **Push notifications** are sent by the database itself (Postgres triggers → Expo push service) when friends post, react, comment, send or accept requests, or add you to a group. The app needs an Expo project id to receive them (`npx eas-cli@latest init`), and on Android a development build rather than Expo Go.
- **Photos.** Post photos are private (friends get short-lived signed links); profile photos are public to signed-in users.
- **Bars** come from [OpenStreetMap](https://www.openstreetmap.org/copyright) via the free public Overpass API. OpenStreetMap has no ratings, so "best" is a Cheers score: Cheers ratings for a venue first, then what the listing offers and distance. The public server is sometimes overloaded; the app retries and shows a "try again" card.

## Tech stack

[Expo](https://expo.dev) SDK 57 · [Supabase](https://supabase.com) · TanStack Query · React Native 0.86 · React 19 with the React Compiler · TypeScript · Expo Router (native tabs) · Reanimated · react-native-maps · expo-location, expo-image-picker, expo-haptics, expo-audio, expo-notifications, expo-file-system.

## Project structure

```
src/
  app/          Screens (Expo Router): index (Feed), map, post (Share), groups (list → group page, new/edit sheets), profile
  components/   UI building blocks: cards, buttons, post cards, group pieces, badges, map, panels
  auth/         Sign-in (email + password, reset code), onboarding, auth session
  data/         Supabase API, the store (cached queries + optimistic updates + realtime), beers, cards, badges
  feedback/     Rewards: haptics, sounds, toasts and the celebration overlay
  lib/          Supabase client, query cache, location, geo helpers, bar search, notifications
  constants/    Theme: colors (light + dark), spacing, radii
assets/sounds/  Chime and pop sound effects
supabase/       Migrations (schema, security rules, push triggers, beer catalog) and database tests
```

Developer notes on architecture and conventions are in [CLAUDE.md](CLAUDE.md).
