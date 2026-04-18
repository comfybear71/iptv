# ComfyTV — HANDOFF.md

## What the user wants (source of truth)

ComfyTV is a **friends-and-family IPTV storefront + client portal**. The user (owner) is building this for non-technical family. They want:

1. **Browse Channels (`/dashboard/channels`)** — categories sidebar on the left (like MyBunny's portal layout) with each row showing `hearted/total` counts (green prefix for hearts), scrollable/searchable channel grid on the right. Every user sees the **full master catalog** (~21k channels / ~36 groups) regardless of their MyBunny sub-account config.
2. **Hearts (♥) = personal playlist.** Tapping a heart on any channel adds it to the user's personal M3U. Only hearted channels appear in the M3U URL. Small, curated, fast.
3. **Personal M3U URL** — contains only the user's hearted channels (typically 10-100). Loads instantly in webplayer.online / TiviMate / IPTV Smarters / VLC. Removable pills on the playlist card let users unheart channels with one click.
4. **Sports hub (`/dashboard/sports`)** — curated tiles (AFL, NRL, EPL, UFC, etc.) with the relevant channels + upcoming fixtures.
5. **VOD Movies + Series** — copy-one-URL pattern.
6. **How to Watch** — device-specific setup instructions. Recommend real IPTV apps over webplayer.online (real apps handle larger playlists, better video quality, etc.)

### Curation happens on MyBunny's master portal, not in ComfyTV code

The user curates which **categories** appear on ComfyTV by ticking/unticking them on **MyBunny's master account portal** (id=12905 / username `gfjxcfhq`). Our catalog-refresh pulls whatever is ticked. No code-based blocklist — if the user doesn't want adult channels in ComfyTV, they untick them on MyBunny.

Users then curate which **channels** they want to watch by hearting them in Browse Channels.

**Do NOT build:**
- A category **picker** that makes the user tick/save selections before seeing content (the sidebar is a filter, not a picker).
- Anything that depends on MyBunny's portal endpoints (only the M3U download URLs are safe).
- Per-user MyBunny sub-account configuration (customers shouldn't need to configure anything on MyBunny).
- A personal M3U that dumps all 21k channels into the user's IPTV app (makes IPTV apps crawl; hearts replace it).

## Current state (2026-04-17 late night)

### Working on production (verified on admin + dad's device)

- **Master channel catalog** — `channels` collection in Mongo stores all ~21k channels from the master account. Every user sees the same catalog. Refresh on demand via `/admin`.
- **Per-user playback URLs** — when a user hits play, we swap *their* credentials into the stream URL pattern (`http://turbobunny.net/{user}/{pass}/{streamId}`). Verified: any valid MyBunny sub-account's creds unlock any stream ID in the master catalog.
- **Categories sidebar on `/dashboard/channels`** — desktop: always-visible; tablet/mobile: dropdown above the grid. Each row shows `hearted/total` (e.g. `Australia 5/490`) with the hearted portion in green.
- **Channel search** works across `name`, `tvg-name`, `tvg-id` via MongoDB `$or`. Client `fetch()` uses `cache: "no-store"` so Vercel edge doesn't serve stale results.
- **Personal M3U = hearts only** — `/api/playlist/[token]` returns only the user's hearted channels. Typically 10-100 channels = small, fast, works everywhere (webplayer.online, TiviMate, IPTV Smarters, VLC). Empty state = valid M3U with a friendly hint comment.
- **Removable pills on the playlist card** — each hearted channel shows as a green pill with `×`. Clicking `×` unhearts the channel.
- **Sports hub Next: previews** — AFL and UFC tiles show an at-a-glance "Next: fixture · day" badge fetched on page mount, so users see what's coming without clicking in.
- **AFL channel filter** — tightened; returns ~10-20 relevant channels (7AFL, WAFL, Fox Footy, Kayo AFL) instead of 100+ unrelated AU channels.
- **In-site live TV playback 🎬 (shipped 2026-04-17)** — tap ▶ on any channel in Browse Channels or Sports, the stream plays **inline** at `/watch/[streamId]` via `mpegts.js`. Backed by a self-hosted Caddy + Node proxy on a DigitalOcean droplet at `stream.comfytv.xyz`. 60-second HMAC-signed URLs minted by `/api/me/stream/[streamId]`. Graceful VLC / personal-M3U / setup-guide fallback on iOS Safari and when the droplet isn't reachable. Full architecture + runbook in CLAUDE.md.
- **VOD Movies + Series in-site playback 🎬 (shipped 2026-04-18)** — `/dashboard/movies` and `/dashboard/series` now show a "Latest Added" poster row + year/genre-filterable grid. Click any poster → `/watch/movie/[id]` or `/watch/series/[id]` (with season/episode picker). Native `<video>` element through the same droplet proxy as live TV, so MP4 plays inline with native controls (seek / pause / fullscreen free). MyBunny Xtream API responses are cached in Upstash Redis (1h for list endpoints, 24h for detail) — cache is optional, falls back to live-fetch if env vars aren't set. The M3U URL card is kept at the top of each page for users who prefer TiviMate / IPTV Smarters / VLC.
- **Admin debug endpoint** `/api/admin/channels/debug?q=...&category=...` — read-only diagnostic returning raw Mongo query results + a parallel `queryChannels()` run for comparison.

### What's broken / pending

- **Hearts toggle refresh bug** — ♥ click on Browse Channels fires the mutation but category-count badges + hearted-pill strip don't re-render until a full page reload. Suspect optimistic update in `useFavorites` + `favByCategory` reconciliation after POST.
- **UFC fight-card expand** — currently wired to TheSportsDB's `strResult`, which is empty for upcoming fixtures on the free tier. Either drop the expand UI or replace the data source with Wikipedia's REST API (see Queued).
- Sports Phase C work (channel ↔ event matching, remind-me, live-now badges) deferred.
- EPG "Now Playing" badges on channel tiles — not started.
- Stripe checkout path (alternative to SOL/BUDJU for non-crypto customers) — not started.

## Today's big solves: master catalog + search + streaming + hearts-as-playlist

### The problem we set out to solve
Different MyBunny sub-accounts have different channel provisioning — admin's master account had all channels but customer accounts only had a subset. Browse Channels was showing each user only their own limited M3U, so the dad's lite account saw ~8 channels while admin saw 21k. We needed every user to see the full catalog regardless of their sub-account config.

### Architecture we landed on
1. Admin clicks **Refresh Catalog** on `/admin` — fetches master M3U from MyBunny using env-var reseller creds, wipes + reloads the `channels` collection in MongoDB.
2. `/api/channels/categories` and `/api/channels/streams` read from `channels` in Mongo, not from each user's M3U.
3. Playback URLs built on the fly by swapping the **logged-in user's** credentials into the stream URL pattern. MyBunny authenticates the user on playback; the catalog comes from the master.
4. **The personal M3U URL contains only hearted channels.** Users curate by tapping ♥ in Browse Channels. Typically 10-100 channels → loads instantly everywhere, including webplayer.online (whose 30s timeout killed the full-catalog approach).

### Diagnostic bugs we hit and how we fixed them
1. **Refresh Catalog error** → Vercel function hitting timeouts because `deleteMany` + `ordered:true` insertMany of 21k docs was slow. Fix: `dropCollection` + `ordered:false` + parallel index creation + `AbortController` timeout on the MyBunny fetch.
2. **Search returning wrong channels** → Symptom was "16 channels · page 1/1" display with 20+ channels actually rendered — meaning total and streams were inconsistent. After 3 failed fix attempts (added tvg-id to `$or`, added `force-dynamic` on server route, added `line-clamp-2` UI), user pointed out the count/list mismatch. Real root cause: client-side `fetch()` had no cache hint so Vercel's edge was caching the first response and serving it for subsequent search queries. Fix: `cache: "no-store"` on the client fetch.
3. **Personal M3U endpoint hanging webplayer.online** → 4 MB M3U generation for 21k channels was too slow + too big. First attempt: compound index, projection, streaming via ReadableStream. Still slow on dad's network because 4 MB over weak connection hit webplayer's 30s timeout. Real fix: **drop the all-channels model entirely and make the M3U contain only hearted channels** — small, fast, works on every device and in every IPTV app.

### Diagnostic technique that cracked the search bug
Built `/api/admin/channels/debug?q=...` that returns (a) an inline raw Mongo query and (b) the same query via `queryChannels()` (the function `/api/channels/streams` uses). Side-by-side comparison showed the data was in Mongo correctly — the bug had to be at the HTTP layer, not the DB layer. User's observation ("16 shown but list is longer") was what cracked it.

## What I (Claude) got right/wrong this session — don't repeat these

1. **Guessed at fixes for the search bug** before inspecting real data. Three failed attempts (tvgId, force-dynamic, display fixes) before stopping to build the debug endpoint. The debug endpoint cracked it in one query.
2. **Followed the master rules' 3-strike diagnostic-summary rule** — after 3 failed attempts on search, stopped and asked the user for diagnostic data instead of shipping another blind guess. That's what unblocked us.
3. **Over-engineered the playlist streaming** — spent a PR adding compound indexes + projection + ReadableStream to serve 21k channels in 4 MB, when the right answer was to not serve 21k channels at all. Users don't want 21k channels in their TV app; they want 30 favourites. The hearts-only M3U is the right design, and it also happens to be faster, simpler, and more user-friendly.
4. **Kept PRs focused** — one concern per PR, each with a complete handoff + release tag suggestion. Eight+ PRs shipped cleanly today vs. the earlier pattern of mashing 5 changes into one.

## Next steps

### Queued (top of the next session's list)

**1. Phantom same-device flow refactor (Option B — queued for future).** We currently use Phantom's *deeplink* protocol on iOS (`phantom.app/ul/v1/connect` + encrypted X25519 responses, client-side decrypt). Works today after the `/subscribe/callback` + `localStorage` fixes, but it's fragile and tightens every iOS release. The proven alternative — verified in the `aiglitch` repo — is Phantom's **browse universal link**: redirect `phantom.app/ul/browse/<our-url>` opens our page *inside Phantom's in-app Chrome webview*, where `window.solana` is live. The same web3.js code used on desktop (`.connect()`, `.signTransaction()`) just works — no deeplink encryption, no sessionStorage/localStorage gymnastics, no callback-parsing page.

The catch: Phantom's in-app browser has its own cookie jar, so the NextAuth Google session from Safari does NOT follow the user into Phantom's browser. aiglitch solves this with an **intent pattern**:
  - Safari (authenticated) → POST `/api/subscription/create-intent` with plan + wallet + amount → returns opaque `intentId` (Redis/Mongo, 10 min TTL).
  - Safari redirects user to `phantom.app/ul/browse/comfytv.xyz/pay?i=<intentId>`.
  - Phantom browser opens the `/pay?i=...` page, no auth needed because `intentId` is the bearer.
  - `/pay` calls `window.solana.connect()` → backend builds a fresh Solana tx → wallet signs → backend submits → marks user's subscription active on success.
  - User closes Phantom, Safari tab polls / refreshes and sees the new subscription.

Scope estimate: ~200 LOC, three new backend routes (`create-intent`, `build-and-sign`, `submit`), one new `/pay/[intentId]` page, intent storage (Mongo collection with TTL index is fine — no need for Redis). Also cleanly fixes wallet-switching (every tx calls `.connect()` fresh) and eliminates Bug B (pay-click user-gesture drop on iOS — no more async work between click and redirect).

Reference implementation: https://github.com/comfybear71/aiglitch — see `src/app/api/auth/sign-tx/route.ts` and `src/app/auth/sign-tx/page.tsx` for the three-action backend + same-device page patterns.

When to do this: bundle with the Stripe checkout work (both touch the payment flow, worth refactoring the subscribe path once). Or sooner if iOS Safari breaks the deeplink protocol again.

**2. Hearts toggle needs page refresh on Browse Channels.** ♥ click fires the mutation but category-count badges + hearted-pill strip don't re-render until reload. Suspect optimistic update in `useFavorites` + `favByCategory` state aren't reconciling after POST. Small, self-contained bug — good first task for a fresh session.

**2. UFC fight-card expand** — two paths, pick one:
  - **Drop it.** TheSportsDB's free tier has empty `strResult` / `strDescriptionEN` for upcoming UFC events and `lookupevent.php` is stubbed (returns Liverpool vs Swansea 2014 for any ID on key `3`). Expand shows nothing useful. Easiest: remove the expandable UI in `src/app/dashboard/sports/page.tsx`.
  - **Wire it to Wikipedia REST API.** Structured fight-card tables on every announced UFC event, e.g. `https://en.wikipedia.org/api/rest_v1/page/html/UFC_Fight_Night:_Burns_vs._Malott`. `strEvent` from TheSportsDB maps cleanly to a Wikipedia title slug — parse the first `<table class="toccolours">` for fights. ~50 lines of server-side parser + lazy fetch on expand.

**3. Tuning for the in-site player (minor).** Already-working playback buffers briefly on first start. Two cheap tweaks:
  - `src/app/watch/[streamId]/page.tsx` — bump mpegts.js `stashInitialSize` from 128 → 256 or 384 KB for a bigger head-start buffer.
  - `/etc/comfytv-stream/.env` on the droplet — leave as-is, but consider upgrading the $6 droplet to $12 (2 GB RAM) if concurrent viewers climb past 3-5.

**4. Monitoring for the droplet.** Currently unmonitored. Quick wins:
  - Point UptimeRobot (or similar) at `https://stream.comfytv.xyz/health` — alerts on downtime.
  - Weekly `journalctl -u comfytv-stream` glance for error patterns.
  - Optional: wire a tiny `/api/admin/stream-proxy-health` endpoint so the `/admin` page shows proxy status.

**5. Other queued:**
- Fix AFL events source (swap to Squiggle API — code exists in a prior branch, needs a clean PR).
- Stripe payment option (alternative to SOL/BUDJU for non-crypto users).
- Phase C sports work: channel ↔ event matching, "remind me", live-now badges.
- EPG "Now Playing" badges on channel tiles.

### Recently completed
- v1.3.x: Category sidebar on Browse Channels; removed redundant Movies/TV Series tiles.
- v1.4.0: Master channel catalog + admin refresh button.
- v1.4.x patches: Refresh perf (dropCollection + ordered:false); category sidebar UX (lg breakpoint, collapsible); main dashboard sidebar collapsible; `$or` search + tvg-id; force-dynamic; debug endpoint; `cache:"no-store"` (the search bug killer).
- v1.4.7: Streaming M3U + compound index + projection (the personal M3U speed fix — later superseded by the hearts-only model).
- v1.5.0: Personal M3U = hearts only. Users curate their playlist by tapping ♥. Empty state handled with a friendly hint comment in the M3U.
- v1.5.1: Hearted-count badges in the sidebar (`Australia 5/490` with green hearted count) + removable pills on the playlist card (each hearted channel as a pill with `×` to unheart).
- v1.6.x: Sports tile "Next: …" previews (AFL + UFC), tighter AFL filter, always-on desktop categories sidebar.
- v1.7.x: In-site HLS player scaffolding + test mode (`/watch/[id]?test=1`) + Vercel serverless proxy (kept only as reference; not used on the shipping path).
- **v1.8.0 (the big one): In-site MPEG-TS live TV via droplet proxy.** DigitalOcean droplet (`stream.comfytv.xyz`) running Caddy + a tiny Node HMAC-verifier, `mpegts.js` in the browser, 60-second signed URLs, graceful VLC / personal-M3U fallbacks. Shipped 2026-04-17.

## Session Log

### 2026-04-13 — Initial build
- Next.js app scaffolded, all pages + API routes implemented, MongoDB + NextAuth + Resend wired up.

### 2026-04-14/15 — Feature sprint
- PR #1–#27: Vercel deploy fixes, wallet linking (Phantom extension + deeplink), multi-month billing, BUDJU gate, iPad fallback, admin polish, sports hub, How-to-Watch page, favourites, M3U playback fix, category picker (then removed).

### 2026-04-16 — Master catalog + UX polish + hearts-only playlist
- PR #28–#29: Category sidebar on Browse Channels (replaces old picker); removed redundant Movies/TV Series tiles.
- PR #30–#31: Mobile layout fixes (flex-col on narrow); catalog sidebar UX.
- PR #32: Master catalog architecture + admin Refresh button + env vars `MYBUNNY_MASTER_USERNAME` / `MYBUNNY_MASTER_PASSWORD`.
- PR #33: Collapsible sidebars + search improvements.
- PR #34: Channel search reliability (`$or` on tvgId, force-dynamic, line-clamp-2).
- PR #35: Admin debug endpoint.
- PR #36: `cache: "no-store"` on client fetch — **the actual fix for the search bug**.
- PR #37: Personal M3U streaming + compound index + projection (partial fix for webplayer hang, later superseded).
- PR #38: Docs — CLAUDE.md + HANDOFF.md master catalog update.
- PR #39: Personal M3U = hearts only — the clean UX that ships (webplayer hang solved by not sending 21k channels).
- PR #40: Hearted-count badges in sidebar (green `5/490`) + removable pills on the playlist card.

### Verified on production
- Admin tested full flow end-to-end.
- Dad's device tested via Chrome Remote Desktop: VLC playback of the personal M3U works, webplayer.online loads the curated playlist instantly.

### 2026-04-17 — Sports tile previews, AFL filter, in-site player attempts

PRs merged (via GitHub UI):
- **#48 / #49**: tile "Next: …" previews on AFL + UFC; AFL channel filter tightened (dropped `"australia"` catHint, removed `tv|hd|live` from fallback regex); `/dashboard/channels` desktop sidebar always-on.
- **#50**: `/api/stream/[token]/[id].m3u` single-entry M3U endpoint (token-auth, for webplayer use).
- **#51 / #52**: `/watch/[streamId]` page with hls.js + `/api/me/stream/[streamId]` session-authed lookup.

Everything else on branch `claude/setup-iptv-project-Tqyec` (pushed, not merged). Contains the Vercel serverless proxy at `src/app/api/stream/proxy/[streamId]` plus the `?test=1` mode on `/watch`. Proxy is **not** a shipping solution (see Queued #1) but keep the file as reference — the test mode and hls.js scaffolding are fine.

**Three fix-spirals this session — lessons**
1. Changed stream URL to `/live/{u}/{p}/{id}.m3u8` → turbobunny 400.
2. Added 1-entry M3U wrapped in webplayer.online → 17 MB timeout.
3. Switched to in-site hls.js → ERR_CONNECTION_CLOSED (CORS + mixed content + TLS-cert-on-IP). Then added Vercel serverless proxy → 60 s function timeout.

Final diagnosis (verified by inspecting the stream URL directly in a browser — it downloads a large binary with no extension): **provider returns progressive MPEG-TS over HTTP**. Incompatible with both hls.js and Vercel serverless. Correct fix is droplet-hosted Caddy reverse-proxy + mpegts.js in the browser — see Queued #1.

**Rule 4 note for next Claude**: I burned through the 3-attempt limit and then some. If you hit a dead end on in-site playback, **stop and audit the assumption stack** (URL format? content-type? browser block? infra cap?) before another code change. The test URL (`/watch/anything?test=1`) and the raw-URL-in-address-bar trick are the fastest ways to isolate which layer is broken.

### 2026-04-17 late night — In-site live TV playback 🎬 SHIPPED

After yesterday's three failed in-site playback attempts and the diagnostic breakthrough that the provider streams **progressive MPEG-TS over HTTP**, we pivoted to the architecture the earlier session recommended and it landed on the first try:

- **Branch `claude/droplet-player-v1` (merged as PR #55)** — added `deploy/droplet/` with a one-shot installer + tiny Node proxy + Caddyfile + systemd unit, plus `src/lib/stream-token.ts` (HMAC sign/verify) and reworked `src/app/watch/[streamId]/page.tsx` to use `mpegts.js` (with `hls.js` kept only for `?test=1`). `/api/me/stream/[streamId]` now returns both the raw upstream URL (for VLC copy) and an HMAC-signed 60-second proxy URL. Feature-flagged behind `ENABLE_DROPLET_PLAYER=1` so rollout was zero-risk before the droplet was online.
- **Droplet** — new $6/mo 1 GB Sydney droplet at `170.64.144.109`, `stream.comfytv.xyz` A record pointing at it, one `DOMAIN=stream.comfytv.xyz bash setup.sh` and Caddy auto-issued a Let's Encrypt cert within seconds. Three env vars (`ENABLE_DROPLET_PLAYER=1`, `STREAM_PROXY_HOST`, `STREAM_PROXY_SECRET`) into Vercel, redeploy, done.
- **Result** — tap ▶ on any real channel → Rick and Morty playing inline inside ComfyTV. No webplayer.online bounce, no 30s timeouts, no CORS/TLS errors. Mild first-start buffering, nothing a bigger stashInitialSize or a $12 droplet can't smooth out.

**Lessons that stuck across sessions**
- The test-stream diagnostic (`/watch/anything?test=1` with a public Mux HLS) proved its worth: confirmed the player was healthy before we started touching provider-specific wiring. Saved hours of false trails.
- Rule 6 saved us once: the original droplet the user pointed at was tagged `budju-trader`; we spun up a fresh one instead of risking a live trading stack.
- Vercel serverless is not a streaming host; this is a permanent architectural fact, not a configurable limit.

PR #55 closes this out. The droplet is the shipping infrastructure. Infrastructure to consider later: horizontal scale (load-balanced pair of droplets), monitoring (UptimeRobot on `/health`), per-user bandwidth logging.

### 2026-04-18 — VOD browser 🎬 SHIPPED

Earlier in the day: foreign-language channel filter (v1.8.6/.7), bigger mpegts.js initial buffer + "Buffering…" overlay (v1.8.8), SSH key auth for the droplet with password login disabled.

Then the big one: **VOD Movies + Series in-site playback** (v1.8.9 / this PR).

**Architecture (MVP — no Mongo catalog, Redis-cached passthrough)**
- `src/lib/xtream-vod.ts` — typed fetchers for `get_vod_categories`, `get_vod_streams`, `get_vod_info`, `get_series_categories`, `get_series`, `get_series_info`, each wrapped in `getOrSet` from `src/lib/redis.ts` (Upstash) with 1h / 24h TTLs.
- Seven new `/api/vod/…` routes for category / list / detail / latest lookups, plus `/api/me/vod/[kind]/[id]` (session-authed — mints an HMAC-signed droplet-proxy URL with a 10-min TTL so one signed URL survives a full movie).
- Two new `/watch` routes — `/watch/movie/[id]` and `/watch/series/[id]` — using native `<video>` (movies/episodes are MP4 so no mpegts.js / hls.js needed). Poster + plot + cast; series page has season/episode picker. "Buffering…" overlay reused from live TV.
- `/dashboard/movies` and `/dashboard/series` keep their existing M3U URL cards (TiviMate users unchanged) but now have a scrollable "Latest Added" poster row at top + a filterable poster grid below the year/genre chips.

**Redis is optional** — if `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` aren't set, `getOrSet` runs the loader every time. Slower, still works. PR can merge + deploy before Upstash is wired; caching activates once env vars land.

**Deliberately deferred to future PRs** (noted in this section so they don't get lost):
- Search within VOD.
- Continue-watching / resume timestamps (the `<video>` element gives us currentTime — just need a user-scoped collection to persist it).
- YouTube trailer preview on series pages (`info.youtube_trailer` is already fetched).
- Mongo-backed VOD catalog with admin-triggered refresh (only if the Redis-cache approach proves inadequate for more than 5 users).

### Outstanding
- Hearts-toggle refresh bug on Browse Channels.
- UFC fight-card expand — drop or replace with Wikipedia REST API.
- Squiggle AFL fix.
- Stripe checkout path.
- EPG "Now Playing" badges.
- In-site player polish (droplet monitoring / UptimeRobot on `/health`).
- Phantom same-device flow refactor (Option B — aiglitch pattern, see Queued #1).
- VOD search (Phase 2 of VOD).
- VOD continue-watching / resume timestamps (Phase 2).
- YouTube trailer previews on series (Phase 2).
- Mongo-backed VOD catalog with admin refresh (only if Redis approach proves inadequate).
- Admin "Mark paid (simulate)" test button on `/admin/orders/[id]` — still outstanding.

### Known testing constraints (not bugs — just things to know)

- **Google auto-sign-in on iPhone.** Once a user has signed into Google in iOS Safari, NextAuth + Google OAuth will silently reuse the same account on subsequent visits — even after "Sign Out" on ComfyTV. To test another user's account on the same phone: either sign out of Google itself in Safari (`google.com` → profile → Sign out), use Safari Private Browsing, or use a different browser app. This is a Google-side behaviour, not a ComfyTV bug.
- **Admin test button coming.** `/admin/orders/[id]` will get a "Mark paid (simulate)" button so the admin can exercise the post-payment provisioning flow without spending real SOL/BUDJU. Next PR after the iOS payment fixes settle.
