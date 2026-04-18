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

## Current state (2026-04-18)

### Working on production (verified on admin + user devices)

- **Master channel catalog** — `channels` collection in Mongo stores all ~21k channels from the master account. Every user sees the same catalog. Refresh on demand via `/admin`.
- **Per-user playback URLs** — when a user hits play, we swap *their* credentials into the stream URL pattern (`http://turbobunny.net/{user}/{pass}/{streamId}`). Verified: any valid MyBunny sub-account's creds unlock any stream ID in the master catalog.
- **Categories sidebar on `/dashboard/channels`** — desktop: always-visible; tablet/mobile: dropdown above the grid. Each row shows `hearted/total` (e.g. `Australia 5/490`) with the hearted portion in green.
- **Channel search** works across `name`, `tvg-name`, `tvg-id` via MongoDB `$or`. Client `fetch()` uses `cache: "no-store"` so Vercel edge doesn't serve stale results.
- **Personal M3U = hearts only** — `/api/playlist/[token]` returns only the user's hearted channels. Typically 10-100 channels = small, fast, works everywhere (webplayer.online, TiviMate, IPTV Smarters, VLC). Empty state = valid M3U with a friendly hint comment.
- **Removable pills on the playlist card** — each hearted channel shows as a green pill with `×`. Clicking `×` unhearts the channel.
- **Sports hub Next: previews** — AFL and UFC tiles show an at-a-glance "Next: fixture · day" badge fetched on page mount, so users see what's coming without clicking in.
- **AFL channel filter** — tightened; returns ~10-20 relevant channels (7AFL, WAFL, Fox Footy, Kayo AFL) instead of 100+ unrelated AU channels.
- **In-site live TV playback 🎬** — tap ▶ on any channel in Browse Channels or Sports, the stream plays **inline** at `/watch/[streamId]` via `mpegts.js`. Backed by a self-hosted Caddy + Node proxy on a DigitalOcean droplet at `stream.comfytv.xyz`. 60-second HMAC-signed URLs minted by `/api/me/stream/[streamId]`. Graceful VLC / personal-M3U / setup-guide fallback on iOS Safari and when the droplet isn't reachable. Full architecture + runbook in CLAUDE.md.
- **iOS Phantom wallet flow 🎉** — connect + change-wallet both work end-to-end on iPhone Safari. Deeplink returns go through a dedicated `/subscribe/callback` path (dodges Safari's tab-consolidation), session state lives in `localStorage` (shared across tabs), and the "Change Wallet" button from the dashboard strip uses `?return=<path>` so users land back where they started instead of on `/dashboard/order`. Desktop Phantom-extension flow unchanged.
- **Admin debug endpoint** `/api/admin/channels/debug?q=...&category=...` — read-only diagnostic returning raw Mongo query results + a parallel `queryChannels()` run for comparison.

### What's broken / pending

- **Hearts toggle refresh bug** — ♥ click on Browse Channels fires the mutation but category-count badges + hearted-pill strip don't re-render until a full page reload. Suspect optimistic update in `useFavorites` + `favByCategory` reconciliation after POST.
- **UFC fight-card expand** — currently wired to TheSportsDB's `strResult`, which is empty for upcoming fixtures on the free tier. Either drop the expand UI or replace the data source with Wikipedia's REST API (see Queued).
- **Bug B (iOS pay-click silent drop)** — theoretical risk: Phantom `sign & send` redirect on iOS may be dropped by Safari's user-gesture policy if there's enough async work between click and redirect. **Not yet confirmed on production** — the droplet proxy + in-site player means most users don't need to pay on iPhone to use the service. Flagged for next session if it surfaces.
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

### Queued (next session's list — ordered by priority)

**1. Admin "Mark paid (simulate)" button** on `/admin/orders/[id]`. Lets admin exercise the post-payment provisioning flow (credentials entry, email send, subscription activation) without burning real SOL/BUDJU. Suggested shape: a button that creates a fake `orders` doc and advances it to `status: "pending-credentials"`. Strictly admin-gated; hidden from normal users. Scope: ~40 lines, one route + one button.

**2. Foreign-language channel filter** — hide channels with `(DE)`, `(FR)`, `(ES)`, `(IT)`, `(PT)` prefixes (and similar) at query time. User decision: hide from everyone (not per-user) while building. Cleanest location is `lib/channel-catalog.ts` `queryChannels()` — apply a blocklist regex on `name` in the Mongo filter. Keep the list configurable via a `const EXCLUDED_NAME_PATTERNS` export so it's easy to tweak. ~15 lines.

**3. Hearts toggle refresh bug on `/dashboard/channels`.** ♥ click fires the POST but category-count badges + hearted-pill strip don't re-render until a full page reload. Suspect the optimistic update in `useFavorites` + the `favByCategory` state aren't reconciling after the server POST. Small, self-contained — good first task after the two above.

**4. UFC fight-card expand** — two paths, pick one:
  - **Drop it.** TheSportsDB's free tier has empty `strResult` / `strDescriptionEN` for upcoming UFC events and `lookupevent.php` is stubbed (returns Liverpool vs Swansea 2014 for any ID on key `3`). Expand shows nothing useful. Easiest: remove the expandable UI in `src/app/dashboard/sports/page.tsx`.
  - **Wire it to Wikipedia REST API.** Structured fight-card tables on every announced UFC event, e.g. `https://en.wikipedia.org/api/rest_v1/page/html/UFC_Fight_Night:_Burns_vs._Malott`. `strEvent` from TheSportsDB maps cleanly to a Wikipedia title slug — parse the first `<table class="toccolours">` for fights. ~50 lines of server-side parser + lazy fetch on expand.

**5. In-site player polish (minor).** Playback works; first-start can briefly buffer. Cheap tweaks if you want:
  - `src/app/watch/[streamId]/page.tsx` — buffer config is already tuned (stashInitialSize 384, liveBufferLatencyChasing false). Can go larger on RAM-rich droplets.
  - Consider upgrading the $6 droplet to $12 (2 GB RAM) if concurrent viewers ever climb past 3–5.

**6. Monitoring for the droplet.** Currently unmonitored. Quick wins:
  - Point UptimeRobot at `https://stream.comfytv.xyz/health` — alerts on downtime.
  - Weekly `journalctl -u comfytv-stream` glance for error patterns.
  - Optional: wire a tiny `/api/admin/stream-proxy-health` endpoint so the `/admin` page shows proxy status.

**7. Fix AFL events source** — swap to Squiggle API for fixtures. Code exists in a prior branch, needs a clean PR.

**8. Stripe checkout path.** Alternative to SOL/BUDJU for non-crypto customers. Non-trivial — touches the whole purchase flow. Worth bundling with #9 below if both land.

**9. Phantom same-device flow refactor (Option B — queued for future).** We currently use Phantom's *deeplink* protocol on iOS (`phantom.app/ul/v1/connect` + encrypted X25519 responses, client-side decrypt). Works today after the `/subscribe/callback` + `localStorage` fixes, but it's fragile and tightens every iOS release. The proven alternative — verified in the `aiglitch` repo — is Phantom's **browse universal link**: redirect `phantom.app/ul/browse/<our-url>` opens our page *inside Phantom's in-app Chrome webview*, where `window.solana` is live. The same web3.js code used on desktop (`.connect()`, `.signTransaction()`) just works — no deeplink encryption, no localStorage gymnastics, no callback-parsing page.

  The catch: Phantom's in-app browser has its own cookie jar, so the NextAuth Google session from Safari does NOT follow the user into Phantom's browser. aiglitch solves this with an **intent pattern**:
  - Safari (authenticated) → POST `/api/subscription/create-intent` with plan + wallet + amount → returns opaque `intentId` (Mongo TTL index, 10 min TTL).
  - Safari redirects user to `phantom.app/ul/browse/comfytv.xyz/pay?i=<intentId>`.
  - Phantom browser opens `/pay?i=...` — no auth needed because `intentId` is the bearer.
  - `/pay` calls `window.solana.connect()` → backend builds a fresh Solana tx → wallet signs → backend submits → marks subscription active.
  - User closes Phantom, Safari tab polls / refreshes and sees the new subscription.

  Scope: ~200 LOC, three backend routes (`create-intent`, `build-and-sign`, `submit`), one `/pay/[intentId]` page, intent storage. Also cleanly fixes wallet-switching (every tx calls `.connect()` fresh) and eliminates Bug B (pay-click user-gesture drop). Reference: https://github.com/comfybear71/aiglitch — `src/app/api/auth/sign-tx/route.ts` + `src/app/auth/sign-tx/page.tsx`.

  When to do this: bundle with Stripe (#8) — both touch the payment flow, worth refactoring once. Or sooner if Apple/Phantom break the deeplink protocol again.

**10. Sports Phase C.** Channel ↔ event matching, "remind me" alerts, live-now badges. Deferred until after higher-value items.

**11. EPG "Now Playing" badges on channel tiles.** Needs an EPG source (probably MyBunny's EPG URL — `http://epg.mybunny.tv/btv/USER/PASS/PASS`). Not started.

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
- v1.8.1: Docs sweep — CLAUDE.md in-site-playback architecture section, HANDOFF.md reflecting the droplet as shipping infra.
- v1.8.2: `/subscribe/callback` dedicated path — dodges iOS Safari's tab-consolidation stripping Phantom callback params.
- v1.8.3: Phantom session state moved to `localStorage` so `/subscribe/callback` (fresh Safari tab) can decrypt the keypair created on `/subscribe`.
- v1.8.4: Dashboard "Change Wallet" button routes through `/subscribe/callback?return=<current-path>` instead of `/dashboard/order` — previously the redirect dumped users on a BUDJU-gated page with the callback response silently ignored.

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

### 2026-04-18 — iOS Phantom payment flow fixes 💎

User reported payments + wallet-linking broken on iPhone Safari; worked fine on PC. Ruled out code regression (no payment-touching commits for weeks — env vars, Helius, and `buildPerUserStreamUrl` all unchanged). Diagnosis was environmental — Apple/Phantom tightening iOS Safari behaviour.

Three stacked iOS-specific bugs, each fixed in its own focused PR:

- **PR #58 — `/subscribe/callback` dedicated path (v1.8.2).** Root cause: iOS Safari's tab-consolidation. When Phantom redirected back to `https://comfytv.xyz/subscribe?data=...&nonce=...`, Safari saw a matching existing tab and brought *that* forward — with the original URL, stripping Phantom's encrypted callback payload entirely. Fix: point `redirect_link` at `/subscribe/callback` (a path with no open tab), forcing Safari to navigate fresh with all params intact. The new thin page parses the callback, stores session / verifies tx, then `router.replace`s back to `/subscribe`.
- **PR #59 — localStorage for Phantom session (v1.8.3).** After #58 shipped, users hit "Failed to decrypt Phantom response". Root cause: the new `/subscribe/callback` *was* being treated as a fresh Safari tab — so it had its own empty `sessionStorage`. The dapp keypair created on the original `/subscribe` tab wasn't available to the callback tab. Fix: move all four Phantom storage keys (`keypair`, `session`, `phantom_public_key`, `wallet`) plus `pending_plan_state` from `sessionStorage` → `localStorage` (origin-scoped, shared across tabs). Ephemeral throwaway values, not user credentials — safe to persist slightly longer.
- **PR #60 — `Change Wallet` button flow (v1.8.4).** After #58+#59, the **subscribe** flow worked on iPhone but the **dashboard Change Wallet button** still didn't update the linked wallet. Root cause: `DashboardWalletStrip` built its Phantom deeplink with `redirect_link=/dashboard/order` — a page with no callback-parsing code. Phantom's response was silently discarded, `/api/me/wallet/phantom-mobile` never called, and the page's BUDJU purchase gate blocked users whose new wallet had <1M BUDJU. Fix: route Change Wallet at `/subscribe/callback?return=<current-dashboard-path>`. The callback page learned a same-origin `?return=` param that controls where it redirects after a successful connect. Users now land back on the dashboard page they came from, with the new wallet persisted.

User verified on iPhone Safari: pick plan → Connect Phantom → approve → wallet connected + visible on dashboard + balances correct. Change-wallet flow also working with sub-1M-BUDJU wallets.

**What worked**
- Ship-bug-isolate-fix cycle: each PR addressed one symptom, got merged + tested before the next was built. No giant omnibus patch.
- Testing on desktop first (which works) vs iPhone (which was broken) gave us the "this is iOS-specific" split within minutes.
- User pasting actual URL bar content + screenshot of the /subscribe/callback landing state cracked the "sessionStorage per-tab" hypothesis.
- External reference (the aiglitch project's `phantom.app/ul/browse/` pattern) was surfaced by the user mid-session and documented as **Option B** for future work — gave us a clear "proper long-term answer" to point at even though we shipped the smaller fix today.

**What didn't work (and why we skipped)**
- Aiglitch's `phantom.app/ul/browse/` pattern is the industry-standard path but requires a full intent-pattern refactor (~200 LOC, new API routes, new `/pay` page, wallet-link rework). Decided against as a "third payment attempt in one session" — too much scope. Parked as Queued #9 when Stripe work justifies reopening the payment path.

### Outstanding
- Admin "Mark paid (simulate)" test button.
- Foreign-language channel filter `(DE)`/`(FR)`/`(ES)` etc.
- Hearts-toggle refresh bug on Browse Channels.
- UFC fight-card expand — drop or replace with Wikipedia REST API.
- Squiggle AFL fix.
- Stripe checkout path.
- EPG "Now Playing" badges.
- In-site player polish (buffer tuning, droplet monitoring).
- Phantom same-device flow refactor (Option B — aiglitch pattern).

### Known testing constraints (not bugs — just things to know)

- **Google auto-sign-in on iPhone.** Once a user has signed into Google in iOS Safari, NextAuth + Google OAuth will silently reuse the same account on subsequent visits — even after "Sign Out" on ComfyTV. To test another user's account on the same phone: either sign out of Google itself in Safari (`google.com` → profile → Sign out), use Safari Private Browsing, or use a different browser app. This is a Google-side behaviour, not a ComfyTV bug.
- **Admin "Mark paid" button.** Still unbuilt at end of this session — will land as the first PR of the next one.
- **Bug B (iOS pay-click user-gesture drop) not yet reproduced in real testing.** If a user reports "tap Pay on iPhone and nothing happens", that's Bug B and the fix is eager-blockhash (pre-fetch on plan select so the click handler is synchronous). Don't burn attempts on it before confirming the symptom.
