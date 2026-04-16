# ComfyTV — HANDOFF.md

## What the user wants (source of truth)

ComfyTV is a **friends-and-family IPTV storefront + client portal**. The user (owner) is building this for non-technical family. They want:

1. **Browse Channels (`/dashboard/channels`)** — categories sidebar on the left (like MyBunny's portal layout), scrollable/searchable channel grid on the right. Every user sees the **full master catalog** (~21k channels / ~36 groups) regardless of what their individual MyBunny sub-account has ticked.
2. **Favourites (♥)** — tap a heart on any channel → it's pinned at the top of the user's personal M3U URL under a `⭐ Favorites` group.
3. **Personal M3U URL** — one stable URL per user they can paste into TiviMate / IPTV Smarters / VLC. Served by our own streaming endpoint (bytes flow immediately, no buffering).
4. **Sports hub (`/dashboard/sports`)** — curated tiles (AFL, NRL, EPL, UFC, etc.) with the relevant channels + upcoming fixtures.
5. **VOD Movies + Series** — copy-one-URL pattern.
6. **How to Watch** — device-specific setup instructions.

### Curation happens on MyBunny's master portal, not in ComfyTV code

The user curates which categories appear on ComfyTV by ticking/unticking them on **MyBunny's master account portal** (id=12905 / username `gfjxcfhq`). Our catalog-refresh pulls whatever is ticked. No blocklist/filter needed in our code — if the user doesn't want adult channels in ComfyTV, they untick them on MyBunny.

**Do NOT build:**
- A category **picker** that makes the user tick/save selections before seeing content (the sidebar is a filter, not a picker).
- Anything that depends on MyBunny's portal endpoints (only the M3U download URLs are safe).
- Per-user MyBunny sub-account configuration (customers shouldn't need to configure anything on MyBunny).

## Current state (2026-04-16 evening)

### Working on production

Everything from the previous state list, plus new as of today:

- **Master channel catalog** — `channels` collection in Mongo stores all ~21k channels from the master account. Every user sees the same catalog. Refresh on demand via `/admin`.
- **Per-user playback URLs** — when a user hits play, we swap *their* credentials into the stream URL pattern (`http://turbobunny.net/{user}/{pass}/{streamId}`). Verified: any valid MyBunny sub-account's creds unlock any stream ID in the master catalog.
- **Categories sidebar on `/dashboard/channels`** — desktop: sticky, collapsible; tablet/mobile: dropdown above the grid.
- **Dashboard sidebar is collapsible** on desktop (chevron in header toggles).
- **Channel search** works across `name`, `tvg-name`, `tvg-id` via MongoDB `$or`. Client `fetch()` uses `cache: "no-store"` so Vercel edge doesn't serve stale results.
- **Streaming personal M3U** — `/api/playlist/[token]` now streams via `ReadableStream` + MongoDB cursor + projection + compound index `{group:1, name:1}`. Responds in 1-2s for 21k channels instead of hanging.
- **Admin debug endpoint** `/api/admin/channels/debug?q=...&category=...` — read-only diagnostic returning raw Mongo query results.

### What's broken / pending

- AFL sport events on `/dashboard/sports` currently show English League 1 soccer because we used the wrong TheSportsDB league ID. Squiggle fix drafted but never merged cleanly.
- Sports Phase C work (channel ↔ event matching, remind-me, live-now badges) deferred.

## Today's big solve: master catalog + search + streaming

### The problem we set out to solve
Different MyBunny sub-accounts have different channel provisioning — admin's master account had all channels but customer accounts only had a subset. Browse Channels was showing each user only their own limited M3U, so the dad's lite account saw ~8 channels while admin saw 21k. We needed every user to see the full catalog regardless of their sub-account config.

### Architecture we landed on
1. Admin clicks **Refresh Catalog** on `/admin` — fetches master M3U from MyBunny using env-var reseller creds, wipes + reloads the `channels` collection in MongoDB.
2. `/api/channels/categories` and `/api/channels/streams` read from `channels` in Mongo, not from each user's M3U.
3. Playback URLs built on the fly by swapping the **logged-in user's** credentials into the stream URL pattern. MyBunny authenticates the user on playback; the catalog comes from the master.

### Diagnostic bugs we hit and how we fixed them
1. **Refresh Catalog error** → Vercel function hitting timeouts because `deleteMany` + `ordered:true` insertMany of 21k docs was slow. Fix: `dropCollection` + `ordered:false` + parallel index creation + `AbortController` timeout on the MyBunny fetch.
2. **Search returning wrong channels** → Symptom was "16 channels · page 1/1" display with 20+ channels actually rendered — meaning total and streams were inconsistent. After 3 failed fix attempts (added tvg-id to `$or`, added `force-dynamic` on server route, added `line-clamp-2` UI), user pointed out the count/list mismatch. Real root cause: client-side `fetch()` had no cache hint so Vercel's edge was caching the first response and serving it for subsequent search queries. Fix: `cache: "no-store"` on the client fetch.
3. **Personal M3U endpoint hanging** → 4 MB M3U generation for 21k channels was blocking. Fix: compound index `{group:1, name:1}`, MongoDB projection on needed fields only, and `ReadableStream` that writes M3U lines to the response as they're read from a cursor (no `toArray()` on 21k docs).

### Diagnostic technique that cracked the search bug
Built `/api/admin/channels/debug?q=...` that returns (a) an inline raw Mongo query and (b) the same query via `queryChannels()` (the function `/api/channels/streams` uses). Side-by-side comparison showed the data was in Mongo correctly — the bug had to be at the HTTP layer, not the DB layer.

## What I (Claude) got right/wrong this session — don't repeat these

1. **Guessed at fixes for the search bug** before inspecting real data. Three failed attempts (tvgId, force-dynamic, display fixes) before stopping to build the debug endpoint. The debug endpoint cracked it in one query.
2. **Followed the master rules' 3-strike diagnostic-summary rule** — after 3 failed attempts on search, stopped and asked the user for diagnostic data instead of shipping another blind guess. That's what unblocked us.
3. **Kept PRs focused** — one concern per PR, each with a complete handoff + release tag suggestion. Seven PRs shipped cleanly today vs. the earlier pattern of mashing 5 changes into one.

## Next steps

### Queued
- Fix AFL events source (swap to Squiggle API — code exists in a prior branch, needs a clean PR).
- Stripe payment option (alternative to SOL/BUDJU for non-crypto users).
- Phase C sports work: channel ↔ event matching, "remind me", live-now badges.
- In-browser HLS player (hls.js) so users can watch inside ComfyTV without webplayer.online.
- EPG "Now Playing" badges on channel tiles.

### Recently completed (this session)
- v1.3.x: Category sidebar on Browse Channels; removed redundant Movies/TV Series tiles.
- v1.4.0: Master channel catalog + admin refresh button.
- v1.4.x patches: Refresh perf (dropCollection + ordered:false); category sidebar UX (lg breakpoint, collapsible); main dashboard sidebar collapsible; `$or` search + tvg-id; force-dynamic; debug endpoint; `cache:"no-store"` (the search bug killer).
- v1.4.7: Streaming M3U + compound index + projection (the personal M3U speed fix).

## Session Log

### 2026-04-13 — Initial build
- Next.js app scaffolded, all pages + API routes implemented, MongoDB + NextAuth + Resend wired up.

### 2026-04-14/15 — Feature sprint
- PR #1–#27: Vercel deploy fixes, wallet linking (Phantom extension + deeplink), multi-month billing, BUDJU gate, iPad fallback, admin polish, sports hub, How-to-Watch page, favourites, M3U playback fix, category picker (then removed).

### 2026-04-16 — Master catalog + UX polish
- PR #28–#29: Category sidebar on Browse Channels (replaces old picker); removed redundant Movies/TV Series tiles.
- PR #30–#31: Mobile layout fixes (flex-col on narrow); catalog sidebar UX.
- PR #32: Master catalog architecture + admin Refresh button + env vars `MYBUNNY_MASTER_USERNAME` / `MYBUNNY_MASTER_PASSWORD`.
- PR #33: Collapsible sidebars + search improvements.
- PR #34: Channel search reliability (`$or` on tvgId, force-dynamic, line-clamp-2).
- PR #35: Admin debug endpoint.
- PR #36: `cache: "no-store"` on client fetch — **the actual fix for the search bug**.
- PR #37: Personal M3U streaming + compound index + projection — **fixes the webplayer hang**.

### Outstanding
- Squiggle AFL fix (never merged cleanly).
- Stripe checkout path.
- HLS in-browser player.
