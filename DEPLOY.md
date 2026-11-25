# Deployment — Vercel frontend + Railway backend

## 1. Push the split project
Extract the full ZIP. Use a fresh Git repository or copy the frontend/ and backend/ directories and root files into your existing repository. Do not copy node_modules, .next, .env or data to Git. If upgrading an existing repository, old root app/lib/server/Dockerfile files are obsolete; remove only tracked old source files after backing up local settings/data. The new platform roots must point at the new folders. Commit and push. Run `npm test` at the new root first. In frontend, run `npm install` and commit the generated lockfile for repeatable deployments.

## 2. Railway — reuse existing backend service
Open the existing service or create one from your GitHub repository if you do not have a service yet. In service Settings:
- Source: your GitHub repository, main branch.
- Root Directory: `/backend` (if using backend-only repository, `/`).
- Builder: Dockerfile (auto-detected); remove old Next.js build/start overrides and old config path overrides. Dockerfile is located at the service root; CMD runs `node server.mjs`.
- Healthcheck path: `/health`.
- One replica; disable sleep/serverless mode for live rooms.
- Preserve existing volume or attach a persistent volume at `/app/data`. Back up data first. If volume ownership prevents startup, inspect logs and configure volume permissions; Railway documents RAILWAY_RUN_UID=0 as a workaround for non-root volume ownership (running as root has security tradeoffs).
- Variables:
```
PUBLIC_URL=https://royal-chess-arena-v3.vercel.app
DB_PATH=/app/data/arena.sqlite
```
Use your actual frontend origin exactly, no trailing path. Railway provides PORT; do not override unless needed. Remove old BACKEND_URL from Railway. Optional ADMIN_TOKEN and Stripe secrets stay only on Railway. Use test-mode Stripe first. Webhook URL: https://YOUR-FRONTEND/platform/webhook. If you use a new domain, update PUBLIC_URL and webhook accordingly.
- Generate/keep public domain under Networking; redeploy. Open `https://YOUR-RAILWAY-DOMAIN/health`. Expect `{"ok":true,"service":"royal-chess-backend","version":"3.3.0"}`. `/platform/me` should return JSON with user:null for guests.

## 3. Vercel — reuse existing frontend project
Go to Settings → Build and Deployment (or General, depending on dashboard layout). Set Root Directory to `frontend` (if frontend-only repository, leave root default). Framework preset Next.js. Build command `npm run build`, install `npm install` (or npm ci after lockfile is committed), output default. Node 22 or supported newer LTS. Do not set `npm start` as Vercel build command. Under Environment Variables set for Production:
```
BACKEND_URL=https://YOUR-RAILWAY-DOMAIN
```
Use the actual generated Railway HTTPS origin, without `/api`, `/lan`, or other path. Keep server-only, no NEXT_PUBLIC prefix. No database or Stripe secrets on frontend. Redeploy latest commit after changing variables. Preview domains are not automatically authorized by the backend's exact PUBLIC_URL check. Use a staging backend if needed. For commercial hosting check provider plan terms.

## 4. Verify
Open `https://YOUR-VERCEL-DOMAIN/platform/me`; expect JSON. Open the game, select Private Room and create room. In a second browser/device open same website and join with code or QR. Try public matchmaking with identical variant, team size and time control. Verify move synchronization, login, reconnect and persistence. Players can be on different internet connections.

## Troubleshoot
- 404 HTML: check Vercel root directory and latest deployment. Frontend has Next route handlers for both `/lan` and `/platform`.
- 503 Online services not configured: set BACKEND_URL and redeploy frontend.
- 502 Game server unavailable: inspect Railway /health and deployment logs; check exact BACKEND_URL.
- 403 origin: PUBLIC_URL must exactly match the frontend origin; avoid adding wildcard CORS. Requests remain same-origin from browser to frontend; proxy calls backend server-to-server.
- Room not found: both browsers must use same backend and room must still exist. Restart clears active rooms.
- Too many requests: existing rate limits may be shared by users behind proxy; intended for small-scale deployment.

## Why not a second Vercel backend project?
This backend uses live process memory and a local SQLite database. Standard Vercel functions may be suspended/replaced and their writable filesystem is temporary. A separate Vercel deployment would need a redesigned durable state store (external database and shared rooms), function-compatible routes, concurrency-safe matchmaking and timer logic. It is not a configuration-only change. Railway or equivalent always-on Node hosting is appropriate for this version.

References: https://vercel.com/docs/frameworks/backend ; https://vercel.com/docs/functions/runtimes ; https://docs.railway.com/deployments/monorepo ; https://docs.railway.com/volumes ; https://docs.railway.com/builds/dockerfiles
