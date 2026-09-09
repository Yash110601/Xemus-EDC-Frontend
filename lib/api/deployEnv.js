/**
 * Deploy-target resolver for Xemus EDC.
 * Local development always uses the local backend (EdcLocal SQL via Pr.Edc.API).
 * UAT is disabled — do not point this app at remote UAT databases or APIs.
 */

export const DEPLOY_TARGETS = Object.freeze({
  local: "local",
  prod: "prod",
})

/** Known backend base URLs — no trailing slash on /api paths. */
export const API_BACKEND_URLS = Object.freeze({
  local: "http://localhost:5154/api",
})

/** @returns {"local"|"prod"} */
export function getDeployTarget() {
  const raw = String(process.env.NEXT_PUBLIC_DEPLOY_TARGET || "local").trim().toLowerCase()
  if (raw === "uat") {
    throw new Error(
      "UAT deploy target is disabled. Use NEXT_PUBLIC_DEPLOY_TARGET=local (local EdcLocal DB)."
    )
  }
  if (raw === DEPLOY_TARGETS.prod) return DEPLOY_TARGETS.prod
  return DEPLOY_TARGETS.local
}

/** Resolved EDC backend URL (explicit NEXT_PUBLIC_API_URL wins, else local). */
export function resolveBackendUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_API_URL || "").trim()
  if (explicit) {
    const url = explicit.replace(/\/$/, "").toLowerCase()
    if (url.includes("-uat.") || url.includes("evalusai-be") || url.includes("predc_uat")) {
      throw new Error(
        "UAT API URL is blocked. Set NEXT_PUBLIC_API_URL=http://localhost:5154/api for local EdcLocal."
      )
    }
    return explicit.replace(/\/$/, "")
  }
  return API_BACKEND_URLS.local
}

export function isLocalDeploy() {
  return getDeployTarget() === DEPLOY_TARGETS.local
}

export function isProdDeploy() {
  return getDeployTarget() === DEPLOY_TARGETS.prod
}

/**
 * Dev API proxy — only when explicitly enabled (not used for UAT).
 */
export function shouldUseDevApiProxy() {
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === "false") return false
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === "true") return true
  return false
}

/** Base URL for browser-side fetch (client components). */
export function resolveBrowserApiBaseUrl() {
  const backend = resolveBackendUrl()
  if (typeof window !== "undefined" && shouldUseDevApiProxy()) {
    return "/api-proxy"
  }
  return backend
}

/** Base URL for the current runtime (browser proxy in dev, direct URL otherwise). */
export function getActiveApiBaseUrl() {
  if (typeof window !== "undefined") return resolveBrowserApiBaseUrl()
  return resolveBackendUrl()
}
