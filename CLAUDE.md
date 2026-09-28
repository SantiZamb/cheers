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
```

- There is no test framework set up.
- `npx expo lint` reports one pre-existing error in the template file `src/hooks/use-color-scheme.web.ts` (setState in effect); it is not a regression.
- Typed routes (`experiments.typedRoutes`) are generated into `.expo/types` by the dev server. After adding, renaming or removing a route file, `tsc` reports bogus route-type errors until the dev server has been started once.
- Starting the server with `CI=1` (useful for non-interactive runs) disables file watching/reload.

## Architecture

Product: friends share nights out drinking beer. Core loop: capture (photo) → rate → share → friends react → challenges → repeat. Keep it to the five tab screens; social actions (reacting, commenting, adding friends, viewing a friend) happen inline on existing screens, not on new screens.

Design direction: "clean light by day, nightlife by night" — bold type, white cards on warm off-white (light), near-black with lifted surfaces (dark), amber→orange gradient reserved for primary actions/progress/highlights. Animations should be short (≈150–250 ms entrances; celebration auto-dismisses in ~1.5 s).

- **Routing:** Expo Router, root `src/app/`. `_layout.tsx` nests `FeedbackProvider` → `StoreProvider` → `AppTabs`, configures notifications, and routes notification taps via `data.url`. Tabs: `index` (Feed), `map` (friends map + best bars nearby, with friend management inline), `post` (Share/capture), `challenges`, `profile` (history).
- **Tabs are defined twice:** `src/components/app-tabs.tsx` (native tabs, icons via SF Symbols `sf` + Material `md`) and `src/components/app-tabs.web.tsx` (`expo-router/ui`). Update both when changing tabs. `disableTransparentOnScrollEdge` is required on iOS because screens wrap their scroll views.
- **Data (`src/data/`):** no backend. `types.ts` defines `Post` (kinds `beer` | `night` | `checkin`), `Challenge`, `AppState`. `seed.ts` has the fixed `USERS` (id `'me'` is the current user; some users are unconnected "suggestions"), seed posts/challenges with timestamps relative to now, and `FRIEND_POST_POOL` revealed by pull-to-refresh. `store.tsx` (`useStore`) owns all state and actions and **simulates friends**: after the user posts, friends react/comment on timers and matching local notifications are scheduled. `challenges.ts` derives challenge progress, standings and recaps purely from posts inside each challenge's time window; nothing about progress is stored.
- **Beers & cards:** `beers.ts` is the beer catalog (+ `state.customBeers` for beers typed by the user); beer posts carry a `beerId`. `cards.ts` derives the card collection from posts (like challenges, nothing is stored): 2 XP per check-in of the exact beer, 1 XP per other beer from the same brewery (capped at the exact-beer XP), 2 XP per level, 5 tiers × 5 levels. `addPost` diffs cards before/after to put new cards, level-ups and tier-ups in the celebration. Profile photos: `User.photo` (URL) for friends, `state.profilePhoto` for the user, supplied to `Avatar` through `ProfilePhotoContext` (not `useStore`, to avoid an import cycle via feedback → toast → avatar).
- **Persistence:** `persistence.ts` saves the whole `AppState` as JSON in the document directory (`expo-file-system`) and copies picked photos out of the picker cache; in-memory only on web. **Bump `STATE_VERSION` in `seed.ts` whenever the state shape or seed data changes**, otherwise devices keep loading the old saved state. Profile has a "Reset demo data" button.
- **Rewards (`src/feedback/`):** every rewarding moment goes through `useFeedback()`: `select` (haptic), `pop` (sound + haptic), `toast` (banner for friend activity), `celebrate` (full-screen confetti modal + chime + success haptic). Sounds are generated WAVs in `assets/sounds/`. Audio respects the silent switch and mixes with other audio.
- **Notifications (`src/lib/notifications.ts`):** local only (remote push isn't available in Expo Go on Android). Permission is requested at the first post. Foreground banners are suppressed because the in-app toast covers it.
- **Map & location:** `src/app/map.tsx` = `CheersMap` (react-native-maps; `cheers-map.web.tsx` is a placeholder since maps don't run on web) over a sheet with `FriendsPanel` or `BarsPanel`. Friends' positions are the fixed `lat`/`lng` on `USERS`. The user's position lives in `state.location.me` and sharing mode (`off`/`city`/`precise`) in `state.location.sharing`; `src/lib/location.ts` wraps expo-location (`silent` mode never prompts). Cross-tab handoffs use non-persisted store fields: `mapFocus` (Feed avatar → friend on map) and `draftVenue` (bar "Check in here" → Share form).
- **Bars (`src/lib/bars.ts`):** OpenStreetMap via the public Overpass API, no key. Requests **must** send a `User-Agent` (Overpass returns 406 otherwise) and use exact tag matches (regex queries time out). The public server is often overloaded (504/429, or HTTP 200 with a "timed out" `remark`), so the code retries, falls back to a mirror, caches per location/radius, and the UI has a friendly retry state. "Best" is a Cheers score: Cheers ratings for a venue (matched by normalized name) first, then OSM listing signals and distance. Show the OSM attribution. Pure helpers live in `src/lib/geo.ts` so `bars.ts` can run under Node (`npx tsx`) for quick checks.
- **Theming:** `src/constants/theme.ts` holds `Colors.light`/`Colors.dark` (`accent`→`accentEnd` gradient, `accentSoft`, `onAccent`, `border`, `glass`, `shadow`), `Radius`, `Spacing`, `BottomTabInset`. New colors must be added to both palettes. Build UI from `Card`, `GradientButton`, `Glass`, `Chip` (monochrome, inverts when selected), `ScreenHeader`, `ThemedText` (incl. `overline`) rather than ad-hoc styles.
- **Screen conventions:** wrap screens in `Screen` + `ScreenHeader` (`src/components/screen.tsx`) and add `BottomTabInset` to scroll content bottom padding. The Map screen is the exception (map runs under the status bar).
- **Animations:** Reanimated. React Compiler is enabled, so use `sharedValue.set()`/`.get()` instead of assigning `.value` (lint rejects it), and manual `useMemo`/`useCallback` is generally unnecessary.
- **Expo Go compatibility:** the app is demoed on phones via Expo Go; avoid libraries with custom native code.
