# PR EDC Frontend — Developer Setup Guide

This guide explains how to set up the project locally, switch between backends, and understand how UAT/PROD environments work (PR EDC / Pr.Edc API).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20.x (LTS) |
| npm | 10.x (comes with Node 20) |
| Git | Latest |

Optional for full local stack:

- .NET backend running locally on port **5154** (when using `local` target)

---

## 1. Clone and install

```bash
git clone https://github.com/DHSPL-Tatvacare/PR-EDC-Frontend.git
cd PR-EDC-Frontend
npm install
```

Use branch **`jainish`** for feature work (promotes to `master` → `UAT` → `PROD`).

---

## 2. Environment setup (local only)

### One file: `.env.local`

We do **not** commit `.env`, `.env.production`, or `.env.local` to Git.

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

### Get API keys from team lead

Ask for these values and paste into `.env.local`:

| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_NER_API_KEY` | Tatva voice NER / form-schema |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Google Gemini document OCR |

Without these keys, login/CRF works but voice NER and document OCR may fail.

---

## 3. Backend (local only)

In `.env.local`:

```env
NEXT_PUBLIC_DEPLOY_TARGET=local
NEXT_PUBLIC_API_URL=http://localhost:5154/api
```

UAT is disabled — do not set a remote UAT API URL or UAT database credentials.

Restart after every change:

```bash
npm run dev
```

App runs at: **http://localhost:3000**

---

## 4. Run the project

```bash
# Development (hot reload)
npm run dev

# Production build (local test)
npm run build
npm run start

# Lint
npm run lint
```

---

## 5. Verify backend in browser

1. Open **http://localhost:3000**
2. Open DevTools → **Network** tab
3. Log in or open Dashboard
4. Confirm API calls go to the expected host:

| DEPLOY_TARGET | Expected host |
|---------------|---------------|
| `local` | `localhost:5154` |
| `uat` | `pr-edc-be-uat.ambitiousstone-b2402989.centralindia.azurecontainerapps.io` |
| `prod` | `pr-edc-be-prod.ambitiousstone-b2402989.centralindia.azurecontainerapps.io` |

---

## 6. Files you must NEVER commit

| File | Reason |
|------|--------|
| `.env.local` | Your local secrets + config |
| `.env` | Legacy — removed from Git |
| `.env.production` | Legacy — removed from Git |

**Safe to commit:**

| File | Purpose |
|------|---------|
| `.env.example` | Template for new devs |
| `deploy/env/uat.env.template` | UAT env structure (no secrets) |
| `deploy/env/prod.env.template` | PROD env structure (no secrets) |

Pre-commit check (optional):

```bash
sh scripts/check-no-env-in-git.sh
```

---

## 7. How UAT and PROD work (for awareness)

Developers do **not** set UAT/PROD env via Git files.

| Environment | How env is injected |
|-------------|---------------------|
| **Local** | `.env.local` |
| **UAT** | GitHub Actions `docker build --build-arg` on merge to `UAT` |
| **PROD** | GitHub Actions `docker build --build-arg` on merge to `PROD` |

`NEXT_PUBLIC_*` variables are **baked into the JS bundle at Docker build time**. Changing Azure Portal env vars alone does not fix a wrong backend URL — redeploy via CI.

### Release flow

```
jainish → master → UAT → PROD
```

Never open PRs: `jainish → UAT` or `jainish → PROD` directly.

Details: [Git branch flow](../release/GIT_BRANCH_FLOW.md) · [Deployment & env](../release/DEPLOYMENT_ENV.md)

---

## 8. UAT / PROD env reference (Azure backup)

Full templates (no secret values):

- UAT: `deploy/env/uat.env.template`
- PROD: `deploy/env/prod.env.template`

### UAT main backend

```
NEXT_PUBLIC_API_URL=https://pr-edc-be-uat.ambitiousstone-b2402989.centralindia.azurecontainerapps.io/api
```

### PROD main backend

```
NEXT_PUBLIC_API_URL=https://pr-edc-be-prod.ambitiousstone-b2402989.centralindia.azurecontainerapps.io/api
```

Secrets (`NER_API_KEY`, `GEMINI_API_KEY`) live in **GitHub Secrets** and **Azure Container App** — ask team lead if you need access.

---

## 9. Project structure (quick reference)

```
app/                    # Next.js pages (App Router)
components/             # UI components
lib/
  api/
    config.js           # API config (uses deployEnv.js)
    deployEnv.js        # local | uat | prod URL resolver
    client.js           # HTTP client
  services/             # API service layer
deploy/env/             # UAT/PROD env templates (no secrets)
docs/                   # All project documentation (start at docs/README.md)
.env.example            # Local dev template
.env.local              # YOUR local file (gitignored)
```

---

## 10. Troubleshooting

### Wrong backend URL in Network tab

- Check `NEXT_PUBLIC_DEPLOY_TARGET` in `.env.local`
- Restart `npm run dev` (env is loaded at startup)
- Hard refresh: `Ctrl + Shift + R`

### Login fails on `local`

- Ensure .NET backend is running on port **5154**
- Or switch to `uat` to use remote UAT backend

### Voice NER / OCR not working

- Fill `NEXT_PUBLIC_NER_API_KEY` and `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local`
- Ask team lead for keys

### Accidentally committed `.env.local`

```bash
git rm --cached .env.local
git commit -m "chore: remove accidental env file"
```

Rotate any exposed keys immediately.

---

## 11. New developer checklist

- [ ] Clone repo
- [ ] `npm install`
- [ ] `cp .env.example .env.local`
- [ ] Get NER + Gemini keys from team lead
- [ ] Set `NEXT_PUBLIC_DEPLOY_TARGET=local`
- [ ] Start backend locally (or use `uat`)
- [ ] `npm run dev`
- [ ] Verify Network tab shows correct API host
- [ ] Never commit `.env.local`

---

## 12. Who to ask

| Topic | Contact |
|-------|---------|
| API keys (NER, Gemini) | Team lead / DevOps |
| UAT/PROD deploy issues | DevOps |
| Backend local setup | Backend team |
| Git / PR flow | Team lead |

---

*Last updated: env architecture release (no `.env` in Git, CI docker build-args)*
