/**
 * Xemus EDC deploy hosts.
 * Local development uses localhost only — no UAT hosts or credentials.
 */

export const PR_EDC_HOSTS = Object.freeze({
  localApi: "http://localhost:5154/api",
  localFe: "http://localhost:3000",
})
