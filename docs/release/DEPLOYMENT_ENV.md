# Deployment & Environment

How **Xemus EDC Frontend** is configured for local development.

UAT database / UAT API credentials are **not used** in this workspace. Local always talks to `http://localhost:5154/api` → **EdcLocal** SQL.

---

## Local development

See [Developer setup](../onboarding/DEV_SETUP.md).

```env
NEXT_PUBLIC_DEPLOY_TARGET=local
NEXT_PUBLIC_API_URL=http://localhost:5154/api
```

URL resolution: `lib/api/deployEnv.js` (UAT targets are blocked).

---

## Files you must NEVER commit

| File | Reason |
|------|--------|
| `.env.local` | Local secrets + config |
| `.env` | Legacy — removed from Git |
| `.env.production` | Legacy — removed from Git |

**Safe to commit:** `.env.example`, `deploy/env/prod.env.template`

Pre-commit check (optional):

```bash
sh scripts/check-no-env-in-git.sh
```
