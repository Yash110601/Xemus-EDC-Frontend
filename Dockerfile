# Official Node image via AWS Public ECR (Docker Hub mirror).
# GitHub Actions often times out on registry-1.docker.io; this registry is more reliable in CI.
ARG NODE_BASE_IMAGE=public.ecr.aws/docker/library/node:20-alpine

# Stage 1: Dependencies
FROM ${NODE_BASE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies.
# Prefer npm when package-lock.json exists (this repo is npm-locked in CI).
RUN \
  if [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    npm install; \
  fi

# Stage 2: Builder
FROM ${NODE_BASE_IMAGE} AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# CI must pass build-args (no .env files in Git). Write Next.js production env file.
ARG NEXT_PUBLIC_DEPLOY_TARGET
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NER_API_KEY
ARG NEXT_PUBLIC_GEMINI_API_KEY
ARG NEXT_PUBLIC_GEMINI_OCR_MODEL=gemini-3.1-flash-lite
ARG NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR=true
ARG NEXT_PUBLIC_NER_API_URL
ARG NEXT_PUBLIC_OCR_FORM_FILL_URL

RUN set -e; \
  if [ -z "${NEXT_PUBLIC_DEPLOY_TARGET}" ] || [ -z "${NEXT_PUBLIC_API_URL}" ]; then \
    echo "ERROR: docker build requires --build-arg NEXT_PUBLIC_DEPLOY_TARGET and NEXT_PUBLIC_API_URL"; \
    exit 1; \
  fi; \
  { \
    echo "NEXT_PUBLIC_DEPLOY_TARGET=${NEXT_PUBLIC_DEPLOY_TARGET}"; \
    echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"; \
    [ -n "${NEXT_PUBLIC_NER_API_KEY}" ] && echo "NEXT_PUBLIC_NER_API_KEY=${NEXT_PUBLIC_NER_API_KEY}"; \
    [ -n "${NEXT_PUBLIC_GEMINI_API_KEY}" ] && echo "NEXT_PUBLIC_GEMINI_API_KEY=${NEXT_PUBLIC_GEMINI_API_KEY}"; \
    echo "NEXT_PUBLIC_GEMINI_OCR_MODEL=${NEXT_PUBLIC_GEMINI_OCR_MODEL}"; \
    echo "NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR=${NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR}"; \
    [ -n "${NEXT_PUBLIC_NER_API_URL}" ] && echo "NEXT_PUBLIC_NER_API_URL=${NEXT_PUBLIC_NER_API_URL}"; \
    [ -n "${NEXT_PUBLIC_OCR_FORM_FILL_URL}" ] && echo "NEXT_PUBLIC_OCR_FORM_FILL_URL=${NEXT_PUBLIC_OCR_FORM_FILL_URL}"; \
  } > .env.production.local

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application with the same package-manager preference.
RUN \
  if [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm run build; \
  else \
    npm run build; \
  fi

# Verify NEXT_PUBLIC_API_URL host is baked into client bundle
RUN API_HOST=$(echo "${NEXT_PUBLIC_API_URL}" | sed 's#https://##; s#/api##') && \
    grep -rq "$API_HOST" .next/static || (echo "ERROR: build missing NEXT_PUBLIC_API_URL (${NEXT_PUBLIC_API_URL})" && exit 1)

# Stage 3: Runner
FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]

