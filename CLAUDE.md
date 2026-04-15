# ComfyTV — CLAUDE.md

## The Vision (read this first)

ComfyTV is a **friends-and-family IPTV storefront and client portal**. Customers sign in with Google, buy a subscription (SOL / BUDJU / Stripe soon), and get a one-stop web dashboard to **find, favourite, and watch** the content that comes with their subscription.

### What the user actually wants on this app

The user (site owner) is building this for people who are not tech-savvy. Their friends and family paste-an-M3U flow is too fiddly. They want:

1. **A clean dashboard that shows everything available to them** — live channels, VOD movies, VOD series — searchable, browsable, watchable, without leaving ComfyTV.
2. **An "all channels" list they can scroll/search** on `/dashboard/channels`. Not a filter-by-category gate. Not a category picker that copies what another platform does. Just — **here are all your channels, search away, tap one to watch**.
3. **Favourites (♥)** — tap the heart on any channel to pin it. Favourites appear at the top of the user's personal M3U URL under a "⭐ Favorites" group, so their most-watched channels are always one tap away in IPTV Smarters / TiviMate / OTT Navigator too.
4. **A personal M3U URL** the user can copy into their TV app of choice — this URL is always up to date with their favourites.
5. **A "How to Watch" page** that walks them through setting up IPTV Smarters / TiviMate / VLC on TV / phone / computer.
6. **Sports discovery** at `/dashboard/sports` — pre-curated tiles (AFL, NRL, EPL, UFC, etc.) that surface the relevant channels + upcoming fixtures from neutral sources (Squiggle for AFL, TheSportsDB for global sports).
7. **VOD Movies + VOD Series** — copy-one-URL experience that plays the whole library in their TV app.

### What the user does NOT want

- **Any UI that replicates MyBunny's portal.** MyBunny has a `/client/configure.php` page where you can tick channels one-by-one. The user does **not** want ComfyTV to duplicate that. It's not our job.
- **Category filters that depend on MyBunny's 7-category live-TV grouping.** That's a rabbit hole — MyBunny's own M3U returns whatever channels the user has already configured in their portal, and ComfyTV trying to filter further on top of that just breaks things.
- **Anything that forces the user to leave ComfyTV to configure stuff.** The site should feel like a self-contained app.
- **Hard dependencies on MyBunny's portal endpoints** (anything under `/client/configure.php`, or scraped portal HTML). The only MyBunny endpoints we legitimately use are the M3U download URLs:
  - `/client/download.php?u=X&p=Y` — live TV M3U (reflects whatever channels the user has configured on MyBunny's side, we just proxy it as-is)
  - `/client/Movies.php?u=X&p=Y&s=N` — VOD Movies M3U
  - `/client/Series.php?u=X&p=Y&s=N` — VOD Series M3U

### Guiding principles when building

- **Simple beats clever.** Any page the user opens should show them something useful in under 2 seconds — not a wall of configuration.
- **Ship one focused thing per PR.** Don't pile 5 unrelated changes into a single commit. The user has limited time to review and needs to verify each change individually on Vercel.
- **Discuss before code when the spec is ambiguous.** When in doubt, ask.
- **Never assume.** If an API returns unexpected data, verify it before writing code around it (I made this mistake claiming "180 categories from M3U" when the M3U only had 7).

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** MongoDB (Atlas)
- **Auth:** NextAuth v4 with Google OAuth
- **Styling:** Tailwind CSS
- **Email:** Resend
- **Deployment:** Vercel at comfytv.xyz
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
│       │   ├── streams/route.ts            # GET all channels (paginated, searchable)
│       │   └── _helpers.ts                 # shared auth helper
│       ├── sports/events/route.ts          # Upcoming fixtures (Squiggle / TheSportsDB)
│       ├── playlist/[token]/route.ts       # Personal M3U (live TV proxied from MyBunny, with ⭐ Favorites group prepended)
│       ├── me/…                             # user prefs, favourites, wallet
│       └── admin/…
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
│   ├── mybunny-playlist.ts          # fetch + parse MyBunny's live M3U
│   ├── m3u-parse.ts                 # M3U text → structured entries / back
│   ├── xtream.ts                    # thin Xtream API wrapper (barely used now)
│   ├── thesportsdb.ts               # global sports fixtures
│   ├── squiggle.ts                  # AFL fixtures (Australian)
│   ├── sports.ts                    # curated SPORTS tiles + filter helpers
│   ├── playlist-token.ts            # per-user opaque playlist URL
│   └── email.ts
└── types/
    └── index.ts                     # shared types + PLANS constant
```

## MongoDB Collections
- **users** — `{ name, email, image, role, createdAt, balanceSOL, balanceBUDJU, autoRenew, disabled, walletAddress, walletVerifiedAt, favoriteStreamIds: number[], playlistToken }`
- **orders** — `{ userId, userEmail, plan, months, amount, currency, txHash, status, ... }`
- **subscriptions** — `{ userId, plan, connections, status, startDate, endDate, credentials: { xtremeHost, xtremeUsername, xtremePassword, collectionSize, channelName } }`
- **ledger** — credit/debit entries for internal SOL/BUDJU balance

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
- `/admin` — stats dashboard
- `/admin/users` — all users + on-chain BUDJU balance + credit balance
- `/admin/users/[id]` — user detail with manual wallet link, promote/demote, balance credit/debit, subscriptions, ledger
- `/admin/subscriptions` — all subs with filters: all / active / expiring / expired
- `/admin/subscriptions/[id]` — subscription detail with Xtream credentials form, + N months, resend email, reactivate, mark expired
- `/admin/orders` and `/admin/orders/[id]` — order review + provisioning flow

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
