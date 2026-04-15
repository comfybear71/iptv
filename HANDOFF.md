# ComfyTV — HANDOFF.md

## What the user wants (source of truth)

ComfyTV is a **friends-and-family IPTV storefront + client portal**. The user (owner) is building this for non-technical family. They want:

1. **Browse Channels (`/dashboard/channels`)** — a simple, searchable, always-visible list of **every channel** in the user's M3U. No category filter gates. No "pick categories first" step. Just **all channels → search → tap to watch**.
2. **Favourites (♥)** — tap a heart on any channel → it's pinned at the top of the user's personal M3U URL under a `⭐ Favorites` group.
3. **Personal M3U URL** — one stable URL per user they can paste into TiviMate / IPTV Smarters / VLC.
4. **Sports hub (`/dashboard/sports`)** — curated tiles (AFL, NRL, EPL, UFC, etc.) with the relevant channels + upcoming fixtures (Squiggle for AFL, TheSportsDB for global).
5. **VOD Movies + Series** — copy-one-URL pattern.
6. **How to Watch** — device-specific setup instructions.

**Do NOT build:**
- A category picker that duplicates MyBunny's `/client/configure.php` portal.
- Anything that depends on MyBunny's portal endpoints (only the M3U download URLs are safe).
- Multi-zone filter widgets the user has to configure before seeing content.

## Current state (2026-04-15 evening)

### Working on production
- Full auth (Google), MongoDB, plans, orders, admin panel, wallet linking (Phantom desktop + mobile deeplink)
- Plan gating behind 1M BUDJU
- Crypto checkout (SOL + BUDJU)
- `/dashboard/plans` shows active subs
- `/dashboard/movies` and `/dashboard/series` — filter by year/genre, copy URL
- `/dashboard/sports` — 12 curated sport tiles + channel browser
- `/dashboard/how-to-watch` — device setup guide with credentials
- `/dashboard/wallet` — on-chain SOL + BUDJU balances
- Admin user list shows on-chain BUDJU, manual wallet linking, cancel-concept removed
- Favourites (♥) backend: `GET/POST /api/me/favorites`
- Personal M3U URL: `/api/playlist/{token}.m3u` — proxies MyBunny's live TV M3U, prepends `⭐ Favorites` group
- M3U stream URLs use `.ts` (MPEGTS) for IPTV-app compatibility
- iPhone viewport locked at 1:1 (no auto-rescale)

### What's broken / confused right now
- `/dashboard/channels` has an unwanted category picker (two-zone "My Channels" + "Browse Categories" dropdown). **The user wants it removed** — just show all channels from the M3U with a search box.
- AFL sport events on `/dashboard/sports` currently show English League 1 soccer because we used the wrong TheSportsDB league ID. The Squiggle fix exists in a draft branch but hasn't been merged.

## What I (Claude) got wrong earlier — don't repeat these

1. **Claimed "180 categories" from the M3U when the M3U only returns ~6-7**. MyBunny's portal shows 180 categories, but `/client/download.php?u=X&p=Y` only returns the subset the user has already configured in MyBunny's portal — and at a coarser grouping. Never promise a feature count without verifying against the actual API response.
2. **Kept building category-filter UIs the user didn't want**. The user said multiple times: "I just want all the channels back." I kept rebuilding filters.
3. **Piled unrelated changes into single PRs** (favourites + viewport + M3U proxy + iPhone fix + Squiggle in one PR). From now on: **one focused change per PR**, and **verify on production before starting the next**.

## Next steps

### Immediate (this PR)
- Strip the category picker UI from `/dashboard/channels`. Just show: playlist URL card + search box + full paginated channel list with ♥ hearts. Nothing else.

### Queued
- Fix AFL events source (swap to Squiggle API — code exists in a prior branch, needs a clean PR).
- Phase C sports work: channel ↔ event matching, "remind me", live-now badges. (Deferred until core channels list is happy.)

## Session Log

### 2026-04-13 — Initial build
- Next.js app scaffolded, all pages + API routes implemented, MongoDB + NextAuth + Resend wired up.

### 2026-04-14/15 — Feature sprint
- PR #1–#20: Vercel deploy fixes, wallet linking (Phantom extension + deeplink), multi-month billing, BUDJU gate, iPad fallback, admin polish, sports hub, How-to-Watch page, favourites, M3U playback fix.
- PR #23: Sports Phase B upcoming events via TheSportsDB.
- PR #24: M3U `.ts` fix + favourites.
- PR #25: Attempted full M3U catalog (the 180-category claim that turned out wrong).
- PR #26 (merged): Two-zone category picker **— this is what the user now wants removed**.

### Outstanding
- Remove category picker, restore simple all-channels list (current PR).
- Squiggle AFL fix (next PR).
