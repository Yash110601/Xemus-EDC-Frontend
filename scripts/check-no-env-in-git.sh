#!/usr/bin/env sh
# Block committing real env files (allow .env.example and deploy/env/*.template)
set -e
blocked=$(git diff --cached --name-only | grep -E '^\.env$|^\.env\.(local|production|uat|prod)$|^\.env\.[^e]|^lib/config/aiKeys\.local\.js$' || true)
if [ -n "$blocked" ]; then
  echo "ERROR: Refusing to commit files with secrets:"
  echo "$blocked"
  echo "Use lib/config/aiKeys.local.js locally (gitignored) and Azure for UAT/PROD."
  exit 1
fi
