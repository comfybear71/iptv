# ComfyTV — HANDOFF.md

## Current State
- Full Next.js 14 app built with App Router
- All pages and API routes implemented
- Dark theme, responsive design with Tailwind CSS
- Google Auth via NextAuth configured
- MongoDB integration for users, orders, subscriptions
- Crypto payment flow (SOL + BUDJU + AIGlitch redirect)
- Admin panel for order management and credential provisioning
- Email notifications via Resend

## What's Working
- Landing page with plan cards and feature highlights
- Pricing page with FAQ
- Subscribe flow: plan selection -> payment method -> QR wallet -> tx hash submission
- User dashboard showing active subscriptions and payment history
- Admin dashboard with stats
- Admin order management (confirm, provision credentials)
- Admin users and subscriptions views
- All API routes with auth protection

## What Needs To Be Done Next
1. **Vercel Deployment** — connect repo, set env vars, deploy
2. **Google OAuth Setup** — create OAuth credentials in Google Cloud Console
3. **MongoDB Atlas** — create cluster, get connection string
4. **Resend Setup** — get API key, configure sending domain
5. **Wallet Addresses** — set SOL and BUDJU wallet addresses in env
6. **Custom Domain** — point comfytv.xyz to Vercel
7. **Testing** — end-to-end testing with real auth and database

## Session Log
### 2026-04-13 — Initial Build
- Created full ComfyTV Next.js app from scratch
- Implemented all pages: landing, pricing, dashboard, subscribe, admin (5 pages)
- Implemented all API routes: auth, orders, subscriptions, price, admin endpoints
- Created shared components: Navbar, PlanCard, AdminGuard, SessionWrapper
- Set up MongoDB connection, NextAuth config, email utilities
- Created CLAUDE.md and HANDOFF.md documentation
