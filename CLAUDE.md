# ComfyTV — CLAUDE.md

## The Vision (read this first)

ComfyTV is a **friends-and-family IPTV storefront and client portal**. Customers sign in with Google, buy a subscription (SOL / BUDJU / Stripe soon), and get a one-stop web dashboard to **find, favourite, and watch** the content that comes with their subscription.

### What the user actually wants on this app

The user (site owner) is building this for people who are not tech-savvy. Their friends and family paste-an-M3U flow is too fiddly. They want:

1. **A clean dashboard that shows everything available to them** — live channels, VOD movies, VOD series — searchable, browsable, watchable, without leaving ComfyTV.
2. **A channel browser** on `/dashboard/channels` with a **categories sidebar** (like MyBunny's portal) + a scrollable channel grid. Every user sees the full **master catalog** (~21k channels / ~36 categories), not just what's ticked on their individual MyBunny sub-account. Each sidebar category shows a `hearted/total` badge (e.g. `Australia 5/490`) with the hearted count in green.
3. **Hearts (♥) = personal playlist.** Tapping a heart on any channel adds it to the user's personal M3U URL. The M3U contains **only hearted channels** — typically 10-100, not 21k. This keeps the playlist small, fast, and actually usable in IPTV apps (nobody wants to scroll through 21k channels in TiviMate).
4. **Personal M3U URL card** — shows a live count, a Watch button (webplayer.online), a Copy URL button, and green removable pills (one per hearted channel, `×` to remove). Users can manage their playlist without scrolling through the full catalog.
5. **A "How to Watch" page** that walks them through setting up IPTV Smarters / TiviMate / VLC on TV / phone / computer. Real IPTV apps > webplayer.online for everyday viewing.
6. **In-site playback.** Tapping ▶ on any channel opens `/watch/[streamId]` and plays the stream **inline**, no bouncing to another site. Powered by `mpegts.js` in the browser + a self-hosted Caddy + Node proxy on a DigitalOcean droplet at `stream.comfytv.xyz`. Graceful VLC / personal-M3U fallbacks on iOS Safari and anywhere the droplet isn't reachable.
7. **Sports discovery** at `/dashboard/sports` — pre-curated tiles (AFL, NRL, EPL, UFC, etc.) that surface the relevant channels + upcoming fixtures from neutral sources (Squiggle for AFL, TheSportsDB for global sports).
8. **VOD Movies + VOD Series** — copy-one-URL experience that plays the whole library in their TV app.

### Curation happens on MyBunny's portal, not in ComfyTV

The **master MyBunny account (id 12905 / `gfjxcfhq`)** is the source of truth for what categories/channels exist in ComfyTV. When the admin unticks "Adult" on MyBunny's configure page and clicks "Refresh Catalog" on `/admin`, those channels disappear from every ComfyTV user's view. There is **no code-based blocklist**; the admin curates at the MyBunny layer.

### What the user does NOT want

- **A category picker that makes the user tick+save before seeing content.** The sidebar is a filter (click to narrow), not a picker.
- **Anything that forces the user to leave ComfyTV to configure stuff.** The site should feel like a self-contained app.
- **Per-user MyBunny sub-account tweaks.** Customers shouldn't need anything configured on MyBunny's side beyond having valid credentials. The master catalog + per-user playback URLs handles the rest (confirmed: any valid MyBunny sub-account's creds unlock any stream ID in the master catalog).
- **A personal M3U that dumps all 21k channels into the user's IPTV app.** Nobody wants to scroll through 21k channels in TiviMate. The personal M3U is **hearted channels only** — small, curated, fast.
- **Hard dependencies on MyBunny's portal HTML** (anything under `/client/configure.php`, or scraped portal pages). The only MyBunny endpoints we legitimately use are the M3U download URLs:
  - `/client/download.php?u=X&p=Y` — live TV M3U (used once per refresh with master creds, stored in Mongo)
  - `/client/Movies.php?u=X&p=Y&s=N` — VOD Movies M3U
  - `/client/Series.php?u=X&p=Y&s=N` — VOD Series M3U

### Guiding principles when building

- **Simple beats clever.** Any page the user opens should show them something useful in under 2 seconds — not a wall of configuration.
- **Ship one focused thing per PR.** Don't pile 5 unrelated changes into a single commit. The user has limited time to review and needs to verify each change individually on Vercel.
- **Discuss before code when the spec is ambiguous.** When in doubt, ask.
- **Never assume.** If an API returns unexpected data, verify it before writing code around it (I made this mistake claiming "180 categories from M3U" when the M3U only had 7).
- **Diagnose before the 4th attempt.** Master rules: after 3 failed fix attempts, STOP and build/ask for diagnostic data. The `/api/admin/channels/debug` endpoint was built exactly because three blind search-fix attempts had failed — it cracked the bug in one query.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** MongoDB (Atlas)
- **Auth:** NextAuth v4 with Google OAuth
- **Styling:** Tailwind CSS
- **Email:** Resend
- **Deployment:** Vercel at comfytv.xyz
- **Stream proxy:** DigitalOcean droplet running Caddy (TLS terminator) + a tiny Node service (HMAC verifier + upstream piper). Subdomain: `stream.comfytv.xyz`. One-shot installer + systemd unit + Caddyfile all live in `deploy/droplet/`.
- **In-browser player:** `mpegts.js` for live MPEG-TS (Chrome / Firefox / Edge / Android). `hls.js` is still bundled for the `/watch/[id]?test=1` diagnostic route (public Mux HLS sample).
- **Language:** TypeScript
- **Content source:** MyBunny.TV (reseller) — Xtream-Codes-compatible panel. We use their M3U endpoints only.

## Project Structure
```
src/
├── app/
│   ├── layout.tsx                   # Root layout + viewport meta
│   ├── page.tsx                     # Landing page
│   ├── globals.css                  # Tailwind + globals
│   ├── pricing/page.tsx             # Public plan comparison
│   ├── subscribe/page.tsx           # Payment flow
│   ├── dashboard/
│   │   ├── layout.tsx               # Sidebar shell + wallet strip
│   │   ├── plans/page.tsx           # "My Plans" (default landing)
│   │   ├── order/page.tsx           # Order a new plan
│   │   ├── invoices/page.tsx        # User's orders
│   │   ├── channels/page.tsx        # Browse Live TV channels (search + favourites)
│   │   ├── sports/page.tsx          # Sports hub (tiles + upcoming events)
│   │   ├── movies/page.tsx          # VOD Movies (filterable URL)
│   │   ├── series/page.tsx          # VOD Series (filterable URL)
│   │   ├── how-to-watch/page.tsx    # Setup guide for TV / phone / computer
│   │   └── wallet/page.tsx          # Wallet + on-chain balances
│   ├── watch/
│   │   └── [streamId]/page.tsx      # In-site HLS/MPEG-TS player (mpegts.js + hls.js)
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── orders/…
│   │   ├── users/…
│   │   └── subscriptions/…
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── orders/…
│       ├── subscriptions/route.ts
│       ├── channels/
│       │   ├── categories/route.ts         # Master catalog categories (from Mongo)
│       │   ├── streams/route.ts            # Master catalog channels — paginated/searchable, per-user playback URLs
│       │   └── _helpers.ts                 # shared auth helper
│       ├── sports/events/route.ts          # Upcoming fixtures (Squiggle / TheSportsDB)
│       ├── playlist/[token]/route.ts       # Personal M3U — contains ONLY the user's hearted channels
│       ├── stream/
│       │   └── [token]/[streamId]/route.ts # Token-auth 1-entry M3U (for webplayer / legacy tools)
│       ├── me/
│       │   ├── favorites/route.ts          # GET / POST {streamId, favorite}
│       │   ├── favorites/detail/route.ts   # GET hearted channels + per-category counts
│       │   ├── stream/[streamId]/route.ts  # Session-auth: raw upstream URL + signed droplet-proxy URL
│       │   └── …
│       └── admin/
│           ├── channels/refresh/route.ts   # GET meta / POST refresh-catalog
│           ├── channels/debug/route.ts     # Admin-only diagnostic for catalog/search
│           └── …
├── components/
│   ├── DashboardWalletProvider.tsx
│   ├── DashboardWalletStrip.tsx
│   └── … (sign-in, navbar, admin guard etc.)
├── hooks/
│   └── useFavorites.ts              # ♥ toggle hook with optimistic updates
├── lib/
│   ├── auth.ts
│   ├── mongodb.ts
│   ├── solana.ts                    # on-chain balance helpers
│   ├── mybunny.ts                   # M3U URL builders
│   ├── mybunny-playlist.ts          # fetch + parse MyBunny's live M3U (legacy — superseded by channel-catalog for most paths)
│   ├── channel-catalog.ts           # MASTER catalog: refresh + query + per-user URL builder
│   ├── m3u-parse.ts                 # M3U text → structured entries / back
│   ├── xtream.ts                    # thin Xtream API wrapper (barely used now)
│   ├── thesportsdb.ts               # global sports fixtures
│   ├── squiggle.ts                  # AFL fixtures (Australian)
│   ├── sports.ts                    # curated SPORTS tiles + filter helpers
│   ├── playlist-token.ts            # per-user opaque playlist URL
│   ├── stream-token.ts              # HMAC-SHA256 sign/verify for droplet-proxy URLs (matches deploy/droplet/server.js)
│   └── email.ts
└── types/
    └── index.ts                     # shared types + PLANS constant

deploy/
└── droplet/                         # Stream-proxy infra (ships on a DigitalOcean droplet, NOT Vercel)
    ├── setup.sh                     # One-shot installer: Caddy + Node 20 + systemd unit + generates HMAC secret
    ├── server.js                    # Dependency-free Node proxy — verifies HMAC token + pipes upstream bytes
    ├── Caddyfile                    # HTTPS reverse proxy for stream.comfytv.xyz → localhost:3000
    ├── comfytv-stream.service       # systemd unit (auto-restart, hardened)
    ├── package.json                 # Declares Node 18+; no npm install needed (built-in modules only)
    └── README.md                    # Setup steps + smoke tests + troubleshooting
```

## MongoDB Collections
- **users** — `{ name, email, image, role, createdAt, balanceSOL, balanceBUDJU, autoRenew, disabled, walletAddress, walletVerifiedAt, favoriteStreamIds: number[], playlistToken, channelPrefs?: { enabledCategoryIds: string[] } }`
- **orders** — `{ userId, userEmail, plan, months, amount, currency, txHash, status, ... }`
- **subscriptions** — `{ userId, plan, connections, status, startDate, endDate, credentials: { xtremeHost, xtremeUsername, xtremePassword, collectionSize, channelName } }`
- **ledger** — credit/debit entries for internal SOL/BUDJU balance
- **channels** — master catalog. One doc per channel: `{ streamId, name, tvgId, tvgName, tvgLogo, group, streamHost, urlScheme, refreshedAt }`. Indexes: `{streamId:1}`, `{group:1, name:1}` (compound — required for the playlist sort to be fast), `{name:1}`.
- **catalog_meta** — single doc `{ key: "catalog", refreshedAt, channelCount, categoryCount }` showing when the catalog was last refreshed.

## Environment Variables
```
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=                       # http://localhost:3000 or https://comfytv.xyz
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAIL=sfrench71@gmail.com
SOL_WALLET_ADDRESS=
BUDJU_WALLET_ADDRESS=
BUDJU_USD_RATE=0.01                 # fallback USD/BUDJU rate
RESEND_API_KEY=
NEXT_PUBLIC_SOL_WALLET_ADDRESS=
NEXT_PUBLIC_BUDJU_WALLET_ADDRESS=
HELIUS_API_KEY=                     # server-only Solana RPC
NEXT_PUBLIC_BUDJU_MINT=             # BUDJU SPL mint address
MYBUNNY_MASTER_USERNAME=             # reseller account — source of the master catalog
MYBUNNY_MASTER_PASSWORD=             # reseller account — source of the master catalog

# In-site playback (stream proxy on DigitalOcean droplet)
ENABLE_DROPLET_PLAYER=1              # feature flag — when unset, /watch shows VLC-fallback UX only
STREAM_PROXY_HOST=stream.comfytv.xyz # public host of the droplet proxy (Caddy + Node)
STREAM_PROXY_SECRET=                 # shared HMAC secret; must match droplet's /etc/comfytv-stream/.env
```

## Pricing Plans (Option X — 50% margin base)
| Plan    | Connections | Price/mo |
|---------|-------------|----------|
| Lite    | 1           | $14      |
| Family  | 2           | $26      |
| Premium | 3           | $35      |
| Titan   | 4           | $42      |

### Multi-month discounts
| Months | Discount |
|--------|----------|
| 1      | 0%       |
| 3      | 10%      |
| 6      | 20%      |
| 12     | 35%      |

### BUDJU holder discounts (stack on multi-month)
| Holdings       | Discount |
|----------------|----------|
| 1M BUDJU       | 10%      |
| 5M BUDJU       | 15%      |
| 10M+ BUDJU     | 20%      |

Plan purchases are gated behind holding ≥ 1,000,000 BUDJU (admins exempt).

## Payment Flow
1. User signs in with Google → auto-redirected to `/dashboard/plans`
2. User picks a plan → hits the `/subscribe` flow
3. Client builds + signs a Solana transaction (Phantom wallet extension on desktop, Phantom deeplink on mobile)
4. Wallet broadcasts the tx via its own RPC (never through ComfyTV)
5. Client polls `/api/orders/verify-tx` which reads the tx on-chain via Helius and marks the order confirmed
6. Admin sees the order in `/admin/orders/[id]` and pastes in the MyBunny Xtream credentials
7. Customer gets an email with their credentials + M3U URL; their `/dashboard/plans` page now shows the active subscription

## Admin
- Admin: `sfrench71@gmail.com` (auto-assigned role on first login)
- `/admin` — stats dashboard + **Master Channel Catalog** card (Refresh button, last-refreshed timestamp, channel + category counts)
- `/admin/users` — all users + on-chain BUDJU balance + credit balance
- `/admin/users/[id]` — user detail with manual wallet link, promote/demote, balance credit/debit, subscriptions, ledger
- `/admin/subscriptions` — all subs with filters: all / active / expiring / expired
- `/admin/subscriptions/[id]` — subscription detail with Xtream credentials form, + N months, resend email, reactivate, mark expired
- `/admin/orders` and `/admin/orders/[id]` — order review + provisioning flow
- `/api/admin/channels/refresh` (GET meta / POST refresh) — backing endpoint for the Refresh Catalog button
- `/api/admin/channels/debug?q=<term>&category=<optional>` — read-only diagnostic that returns raw Mongo query results + a parallel `queryChannels()` run for comparison. Admin-only. Use when search returns unexpected results.

### Refresh Catalog flow
Admin ticks/unticks categories on the master MyBunny portal (account 12905 / `gfjxcfhq`), then clicks **Refresh Catalog** on `/admin`. This hits `/api/admin/channels/refresh` which:
1. Fetches MyBunny's M3U using the master env-var creds (25s AbortController timeout)
2. Parses the M3U with `parseM3u()` → `CatalogChannel[]`
3. `dropCollection("channels")` (O(1) vs `deleteMany` on 21k docs)
4. `insertMany(docs, { ordered: false })` — driver parallelises writes
5. Recreates indexes in parallel (including the compound `{group:1, name:1}` needed for fast playlist generation)
6. Updates `catalog_meta` with counts + timestamp

## In-site playback architecture (the droplet proxy)

ComfyTV plays live IPTV channels **inside the site** via `/watch/[streamId]`. Getting that working required solving three stacked browser-side constraints that IPTV apps (VLC / TiviMate) never face:

1. **Provider streams progressive MPEG-TS over HTTP**, not HLS. `hls.js` can't play that.
2. **Browser CORS + mixed content** block direct `fetch()` from `comfytv.xyz` (HTTPS) to `turbobunny.net` (HTTP, no CORS headers, TLS cert bound to hostname).
3. **Vercel serverless functions cap at 60 s**, so a server-side proxy on Vercel can't pipe a live stream.

Solution (shipped 2026-04-17):

```
Browser ──HTTPS──► comfytv.xyz (Vercel Next.js)          # app stays here
        │         GET /api/me/stream/{id}  →  { streamUrl, proxyUrl }
        ▼         proxyUrl = https://stream.comfytv.xyz/s/<60s-HMAC-signed-token>
Browser ──HTTPS──► stream.comfytv.xyz (DO droplet: Caddy → Node)
                                │ verifies HMAC, decodes upstream URL
                                ▼
                   http://turbobunny.net/USER/PASS/STREAMID   # server-to-server, no browser rules
                   │ pipes MPEG-TS bytes back with CORS headers
                   ▼
mpegts.js in the browser feeds the <video> element.
```

Key files:

- **`src/lib/stream-token.ts`** — HMAC-SHA256 sign / verify. The Node.js `crypto` implementation matches `deploy/droplet/server.js` byte-for-byte so both sides can use the same `STREAM_PROXY_SECRET`.
- **`src/app/api/me/stream/[streamId]/route.ts`** — session-authenticated. Always returns the raw upstream URL (for VLC copy / Open in VLC). Additionally returns a 60-second HMAC-signed `proxyUrl` if and only if `ENABLE_DROPLET_PLAYER=1` AND `STREAM_PROXY_HOST` AND `STREAM_PROXY_SECRET` are all set.
- **`src/app/watch/[streamId]/page.tsx`** — loads the stream info, picks a playback mode: `mpegts.js` through the droplet (happy path), `hls.js` for `?test=1` (Mux sample for diagnostics), or an explicit "VLC fallback" block when no in-site path is available. iOS Safari gets the fallback because it can't do live MPEG-TS over MSE.
- **`deploy/droplet/`** — one-shot installer (`DOMAIN=stream.comfytv.xyz bash setup.sh`) provisions Caddy + Node + systemd on a fresh Ubuntu 22.04/24.04 droplet. The Node service is pure stdlib, no npm install needed on the droplet.

Things to remember:

- **Feature flag is safe-default.** When the env vars aren't set, `/watch` renders with VLC / personal-M3U fallbacks — no broken UI.
- **SSRF-safe.** The HMAC signature covers the upstream URL, so the droplet only ever fetches URLs the Next.js app signed. Tokens expire after 60 seconds.
- **Don't go back to a Vercel-side proxy.** It was tried on branch `claude/setup-iptv-project-Tqyec` (also merged in an earlier state) and always hit the 60-second Vercel function cap. The droplet is the right place for streaming bytes.
- **Don't swap `mpegts.js` for `hls.js` on `/watch`.** The provider streams progressive TS, not HLS — `hls.js` will keep trying to parse the body as a playlist, fail, and hang the `<video>` element. Keep `hls.js` around only for the `?test=1` diagnostic.
- **Monitoring**: `journalctl -u comfytv-stream -f` on the droplet tails request logs. `curl https://stream.comfytv.xyz/health` returns `ok`.

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Deployment (Vercel)
1. Connect repo to Vercel
2. Set all env vars in the Vercel dashboard
3. Pushes to `master` auto-deploy
4. Custom domain: comfytv.xyz

## Development Workflow
- Work happens on feature branches (e.g. `claude/read-documentation-NIp7x`)
- Each PR is squash-merged via GitHub web UI (no direct master pushes)
- After merge, Vercel auto-deploys within ~1 minute
- Auth doesn't work on Vercel preview URLs (different `NEXTAUTH_URL`), so real verification happens on production after merge
- Tag releases via GitHub releases page (`vX.Y.Z-YYYY-MM-DD`)

## Sacred Files (NEVER delete)
- CLAUDE.md
- HANDOFF.md
- README.md
