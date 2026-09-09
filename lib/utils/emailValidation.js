/**
 * Email validation that allows standard formats including hyphens in the local part.
 * Examples: user@domain.com, first.last@example.com, first.last+tag@company.co.in
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

/** Same regex as string for HTML pattern attribute (no ^$ needed - pattern is anchored) */
export const EMAIL_PATTERN = "[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\\.[a-zA-Z]{2,}"

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== "string" || !email.trim()) return false
  return EMAIL_REGEX.test(email.trim())
}

export { EMAIL_REGEX }
