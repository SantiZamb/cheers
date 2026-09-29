# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Cheers** is a demo social app for friends sharing nights out drinking beer, built with Expo (SDK 57), React Native, Expo Router and TypeScript. Expo tooling needs Node ≥ 20.19.

Expo-specific rules (use `npx expo install`, fetch versioned docs instead of trusting memory, never hand-edit `ios/`/`android/`):

@AGENTS.md

## Commands

```bash
npx expo start          # dev server; press i (iOS sim), a (Android), w (web), or scan QR in Expo Go
npx expo start --tunnel # if a phone on the same Wi-Fi can't reach the LAN URL
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npm run test:db         # database RLS/trigger tests (PGlite, no Docker needed)
npx supabase db push    # apply new migrations to the linked Supabase project
```

- There is no app test framework; `npm run test:db` covers the database rules. Add a check there whenever a migration changes who can see or do what.
- Supabase config lives in `.env.local` (git-ignored; see `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put the secret/service_role key in the app. Without them the app shows a setup screen.
- The Supabase CLI is a dev dependency (`npx supabase …`); Homebrew install fails on this machine's Xcode version. No Docker, so no local Supabase stack.
- `npx expo lint` reports one pre-existing error in the template file `src/hooks/use-color-scheme.web.ts` (setState in effect); it is not a regression.
- Typed routes (`experiments.typedRoutes`) are generated into `.expo/types` by the dev server. After adding, renaming or removing a route file, `tsc` reports bogus route-type errors until the dev server has been started once.
- Starting the server with `CI=1` (useful for non-interactive runs) disables file watching/reload.

## Architecture

Product: friends share nights out drinking beer. Core loop: capture (photo) → rate → share → friends react → challenges → repeat. Keep it to the five tab screens; social actions (reacting, commenting, adding friends, viewing a friend) happen inline on existing screens, not on new screens.

Design direction: "clean light by day, nightlife by night" — bold type, white cards on warm off-white (light), near-black with lifted surfaces (dark), amber→orange gradient reserved for primary actions/progress/highlights. Animations should be short (≈150–250 ms entrances; celebration auto-dismisses in ~1.5 s).

- **Routing:** Expo Router, root `src/app/`. `_layout.tsx` nests `FeedbackProvider` → `StoreProvider` → `AppTabs`, configures notifications, and routes notification taps via `data.url`. Tabs: `index` (Feed), `map` (friends map + best bars nearby, with friend management inline), `post` (Share/capture), `challenges`, `profile` (history).
- **Tabs are defined twice:** `src/components/app-tabs.tsx` (native tabs, icons via SF Symbols `sf` + Material `md`) and `src/components/app-tabs.web.tsx` (`expo-router/ui`). Update both when changing tabs. `disableTransparentOnScrollEdge` is required on iOS because screens wrap their scroll views.
- **Backend:** Supabase. Schema, RLS, RPCs and push triggers are migrations in `supabase/migrations/` (never change the database by hand). Visibility: profiles and beers are readable by all signed-in users; posts/reactions/comments by author + accepted friends (`can_see_user`, `can_see_post`); challenges by participants (`is_participant`); groups and their members by members (`is_group_member`); locations by friends while sharing. `create_challenge`/`challenge_summary` and `create_group`/`add_group_members`/`group_leaderboard` are security-definer RPCs (atomic create + invites of the caller's friends only; leaderboards that include non-friend members). Push notifications are sent from Postgres triggers via `pg_net` to Expo's push API (`send_push`), using tokens in `push_tokens` (owner-only).
- **Auth (`src/auth/`):** email + password (`signInWithPassword` / `signUp`). "Confirm email" is off in the Supabase project, so `signUp` returns a session immediately (the screen still handles the no-session case if it's turned back on). There is no password reset flow yet. Session stored in expo-sqlite `localStorage`. `_layout.tsx` gates: setup screen (no env) → `SignInScreen` → `OnboardingScreen` (profile has no name) → tabs, with `Tutorial` (`src/components/tutorial.tsx`, a full-screen modal) on top while `profiles.tutorial_seen` is false; Profile → "How Cheers works" replays it (`openTutorial`). `StoreProvider` is keyed by user id; sign-out clears the persisted query cache.
- **Data (`src/data/`):** `api.ts` holds every Supabase call and maps rows to the app types in `types.ts`. `store.tsx` (`useStore`) is built on TanStack Query: queries keyed per user (`keys`), cache persisted to SQLite by `src/lib/query-client.tsx` (instant cold start, background refresh). Writes use the `optimistic()` helper: patch cache → call server → roll back + toast on failure → invalidate. Post and comment ids are generated client-side (`expo-crypto`) so optimistic items match server rows. A Realtime channel invalidates caches and shows toasts for friend activity. Use `userById`/`myId` from the store; there is no static user list. `challenges.ts` combines the server summary (other participants) with local posts (your own progress, instant). Post photos live in the private `post-photos` bucket and are shown via signed URLs; `expo-image` caches them by `photoKey` (the storage path) because the URLs change. Avatars are in the public `avatars` bucket.
- **Groups:** live inline on the Challenges tab (`GroupCard`, `NewGroupCard`, `FriendPicker`). Group photos go in the public `avatars` bucket under the uploader's folder. Leaderboards (`keys.groupBoard(groupId, period)`) rank members by beers (beer check-ins + night-out `beers_count`), posts, nights, distinct beers, avg rating and reactions received, per week/month/all time. Leaving deletes the group when it's empty.
- **Beers & cards:** `beers.ts` is the built-in catalog (mirrored into the database by the `beer_catalog` migration; keep both in sync) plus custom beers users add (`custom-*` ids). `cards.ts` derives the card collection from posts: 2 XP per check-in of the exact beer, 1 XP per other beer from the same brewery (capped at the exact-beer XP), 2 XP per level, 5 tiers × 5 levels.
- **Rewards (`src/feedback/`):** every rewarding moment goes through `useFeedback()`: `select` (haptic), `pop` (sound + haptic), `toast` (banner for friend activity), `celebrate` (full-screen confetti modal + chime + success haptic). Sounds are generated WAVs in `assets/sounds/`. Audio respects the silent switch and mixes with other audio.
- **Notifications (`src/lib/notifications.ts`):** push tokens need an EAS project id (`npx eas-cli@latest init`); without one, `getPushToken` returns null and only Realtime in-app toasts work. Remote push doesn't work in Expo Go on Android (needs a development build). Foreground banners are suppressed because the in-app toast covers it.
- **Map & location:** `src/app/map.tsx` = `CheersMap` (react-native-maps; `cheers-map.web.tsx` is a placeholder since maps don't run on web) over a sheet with `FriendsPanel` or `BarsPanel`. Friends' positions come from the `locations` table (only friends who share are plotted; 'city' mode is rounded on the device before upload). The user's position lives in `state.location.me` and sharing mode (`off`/`city`/`precise`) in `state.location.sharing`; `src/lib/location.ts` wraps expo-location (`silent` mode never prompts). Cross-tab handoffs use non-persisted store fields: `mapFocus` (Feed avatar → friend on map) and `draftVenue` (bar "Check in here" → Share form).
- **Bars (`src/lib/bars.ts`):** OpenStreetMap via the public Overpass API, no key. Requests **must** send a `User-Agent` (Overpass returns 406 otherwise) and use exact tag matches (regex queries time out). The public server is often overloaded (504/429, or HTTP 200 with a "timed out" `remark`), so the code retries, falls back to a mirror, caches per location/radius, and the UI has a friendly retry state. "Best" is a Cheers score: Cheers ratings for a venue (matched by normalized name) first, then OSM listing signals and distance. Show the OSM attribution. Pure helpers live in `src/lib/geo.ts` so `bars.ts` can run under Node (`npx tsx`) for quick checks.
- **Theming:** `src/constants/theme.ts` holds `Colors.light`/`Colors.dark` (`accent`→`accentEnd` gradient, `accentSoft`, `onAccent`, `border`, `glass`, `shadow`), `Radius`, `Spacing`, `BottomTabInset`. New colors must be added to both palettes. Build UI from `Card`, `GradientButton`, `Glass`, `Chip` (monochrome, inverts when selected), `ScreenHeader`, `ThemedText` (incl. `overline`) rather than ad-hoc styles.
- **Screen conventions:** wrap screens in `Screen` + `ScreenHeader` (`src/components/screen.tsx`) and add `BottomTabInset` to scroll content bottom padding. The Map screen is the exception (map runs under the status bar); its map collapses ("Friends only") when the friend search is focused or the sheet handle is tapped.
- **Animations:** Reanimated. React Compiler is enabled, so use `sharedValue.set()`/`.get()` instead of assigning `.value` (lint rejects it), and manual `useMemo`/`useCallback` is generally unnecessary.
- **Expo Go compatibility:** the app is demoed on phones via Expo Go; avoid libraries with custom native code.
