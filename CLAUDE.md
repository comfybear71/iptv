# ComfyTV — CLAUDE.md

## Overview
ComfyTV is a friends-only IPTV subscription storefront. Customers sign in with Google, choose a plan, pay with cryptocurrency (SOL or BUDJU), and the admin manually provisions their streaming account and sends credentials.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** MongoDB (Atlas)
- **Auth:** NextAuth v4 with Google OAuth
- **Styling:** Tailwind CSS
- **Email:** Resend
- **Deployment:** Vercel at comfytv.xyz
- **Language:** TypeScript

## Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with SessionProvider
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Tailwind + global styles
│   ├── pricing/page.tsx    # Plan comparison
│   ├── dashboard/page.tsx  # User dashboard (subs + orders)
│   ├── subscribe/page.tsx  # Subscription + payment flow
│   ├── admin/
│   │   ├── page.tsx        # Admin dashboard (stats)
│   │   ├── orders/
│   │   │   ├── page.tsx    # All orders table
│   │   │   └── [id]/page.tsx # Order detail + provisioning
│   │   ├── users/page.tsx  # All users list
│   │   └── subscriptions/page.tsx # All subscriptions
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── orders/route.ts        # GET (user orders), POST (create order)
│       ├── orders/[id]/route.ts   # GET single order
│       ├── price/route.ts         # GET SOL/BUDJU prices
│       ├── subscriptions/route.ts # GET user subscriptions
│       └── admin/
│           ├── orders/route.ts       # GET all orders (admin)
│           ├── orders/[id]/route.ts  # GET/PATCH order (admin)
│           ├── users/route.ts        # GET all users (admin)
│           └── subscriptions/route.ts # GET all subs (admin)
├── components/
│   ├── AdminGuard.tsx      # Admin role check wrapper
│   ├── Navbar.tsx          # Top navigation
│   ├── PlanCard.tsx        # Plan pricing card
│   └── SessionWrapper.tsx  # NextAuth SessionProvider
├── lib/
│   ├── auth.ts             # NextAuth config + isAdmin helper
│   ├── email.ts            # Resend email functions
│   └── mongodb.ts          # MongoDB connection singleton
└── types/
    └── index.ts            # TypeScript types + PLANS constant
```

## MongoDB Collections
- **users** — Google profile, email, role ("user" | "admin"), createdAt
- **orders** — userId, plan, amount, currency, txHash, status (pending/confirmed/provisioned)
- **subscriptions** — userId, plan, connections, status, dates, credentials (m3u url, username, password)

## Environment Variables
```
MONGODB_URI=                    # MongoDB connection string
NEXTAUTH_SECRET=                # NextAuth session secret
NEXTAUTH_URL=                   # App URL (http://localhost:3000 or https://comfytv.xyz)
GOOGLE_CLIENT_ID=               # Google OAuth client ID
GOOGLE_CLIENT_SECRET=           # Google OAuth client secret
ADMIN_EMAIL=sfrench71@gmail.com # Admin user email
SOL_WALLET_ADDRESS=             # Solana wallet for receiving payments
BUDJU_WALLET_ADDRESS=           # BUDJU wallet for receiving payments
BUDJU_USD_RATE=0.01             # Fallback USD rate per BUDJU token
RESEND_API_KEY=                 # Resend email API key
NEXT_PUBLIC_SOL_WALLET_ADDRESS= # Public SOL wallet (for frontend display)
NEXT_PUBLIC_BUDJU_WALLET_ADDRESS= # Public BUDJU wallet (for frontend display)
```

## Pricing Plans (30% markup on MyBunny wholesale)
| Plan    | Connections | Price/mo |
|---------|-------------|----------|
| Lite    | 1           | $10.40   |
| Family  | 2           | $19.50   |
| Premium | 3           | $27.30   |
| Titan   | 4           | $33.80   |

## Payment Flow
1. User picks plan and payment method (SOL, BUDJU, or AIGlitch)
2. App shows wallet address as QR code + text, plus exact crypto amount
3. SOL price fetched from CoinGecko API; BUDJU uses fixed rate from env
4. User sends crypto, pastes transaction hash
5. Order created as "pending", admin emailed
6. Admin confirms payment, provisions credentials, customer emailed

## Admin
- Admin: sfrench71@gmail.com (auto-assigned on first login)
- Admin can: view all orders, confirm orders, provision credentials, view users and subscriptions

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment (Vercel)
1. Connect repo to Vercel
2. Set all environment variables in Vercel dashboard
3. Deploy — builds automatically on push
4. Set custom domain: comfytv.xyz

## Sacred Files (NEVER delete)
- CLAUDE.md
- HANDOFF.md
- README.md
