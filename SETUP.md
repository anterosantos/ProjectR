# SPARTA — Local Development Setup

This guide walks you through setting up the SPARTA development environment. Expected time: **~30 minutes** on first setup.

---

## Prerequisites

- **Node.js 22 LTS** or later: [nodejs.org](https://nodejs.org)
- **npm 11+** (ships with Node 22)
- **Docker Desktop** running: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Git** for version control

Verify your setup:
```bash
node --version   # Should be v22.x.x or later
npm --version    # Should be 11.x.x or later
docker --version # Should show Docker version (daemon must be running)
```

---

## Step 1: Clone & Install Dependencies

```bash
git clone <repo-url> sparta-repo
cd sparta-repo/sparta
npm install
```

---

## Step 2: Create Environment Variables File

Copy the template and fill in actual values:

```bash
cp .env.example .env.local
```

Now edit `sparta/.env.local` and fill in the following (marked **TODO** below):

---

## Step 3: Provision Supabase Project (EU Region)

1. Go to [app.supabase.com](https://app.supabase.com)
2. Sign up / Log in
3. **Create new project:**
   - **Project name:** `SPARTA` (or similar)
   - **Region:** Select **Ireland** or **Amsterdam** (EU only; avoid US)
   - **Pricing plan:** Free tier (for MVP)
4. **Wait for provisioning** (~2 minutes)
5. **Copy credentials** from Settings → API:
   - **Project URL:** `https://<spartaef>.supabase.co`
   - **Publishable Key:** (looks like `sb_publishable_...`)
   - **Service Role Key:** (long JWT-format string)
6. **Paste into `.env.local`:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<spartaef>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
   ```

**Verify:** Run `npm run test --run` — if tests pass, Supabase is configured correctly.

---

## Step 4: Create Resend Account (Email Service)

1. Go to [resend.com](https://resend.com)
2. Sign up for account
3. **Create API key** from dashboard (Sending scope)
4. **Paste into `.env.local`:**
   ```
   RESEND_API_KEY=re_...
   ```

**Verify:** Resend region will be configured per-domain later (Story 1.5). For MVP, default US subdomain is acceptable for development.

---

## Step 5: Verify Docker & Start Local Stack

1. **Open Docker Desktop** (if not already running)
2. **Wait for Docker daemon to be ready** (you'll see a steady whale icon in the system tray)
3. **Start Supabase local stack:**
   ```bash
   npx supabase start
   ```
   This pulls Docker images (~2 GB) and brings up:
   - PostgreSQL 17 (port 54322)
   - REST API (port 54321)
   - Auth service
   - Storage
   - Studio web UI (port 54323)
   - And 7 other services...
   
   **Expected output:** "Supabase local development setup is complete."

4. **Verify health:**
   ```bash
   docker ps | grep supabase
   ```
   You should see ~12 containers all with status "Up".

---

## Step 6: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the SPARTA homepage.

---

## Troubleshooting

### Docker not running?
- **Error:** "Cannot connect to Docker daemon"
- **Fix:** Open Docker Desktop app and wait for it to start. The daemon must be running before `supabase start`.

### Missing environment variable?
- **Error:** "Supabase API key not found" or similar at runtime
- **Fix:** Run `npm run build` — this will validate all env vars at compile time and show you which one is missing.

### Port already in use?
- **Error:** "Port 54322 is already in use"
- **Fix:** Either (a) stop the other service, or (b) edit `sparta/supabase/config.toml` and change the port numbers.

### Tests fail?
- **Error:** "Cannot find module '@/...'" or similar
- **Fix:** Make sure you're running tests from the `sparta/` directory: `cd sparta && npm run test --run`

---

## Next Steps

Once setup is complete:

1. **Read the architecture:** `_bmad-output/planning-artifacts/architecture.md`
2. **Check out the current sprint:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
3. **Start contributing:** Pick a `ready-for-dev` story and follow the dev workflow

---

## Getting Help

- **Questions about setup?** Check the troubleshooting section above.
- **Found a bug?** Open an issue on GitHub.
- **Contributing guide:** See `CONTRIBUTING.md` (coming soon).

---

Generated: 2026-05-09 (Story 1.2 Code Review)
