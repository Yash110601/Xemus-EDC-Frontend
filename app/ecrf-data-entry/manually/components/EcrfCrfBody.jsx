"use client"

import { memo } from "react"

/**
 * Phase 3b-3 — Active section field grid shell.
 *
 * The full control-rendering loop (~1.5k lines) remains in `page.jsx` for now because
 * it is tightly coupled to save/submit, SDV, queries, rules, and audit paths. This
 * component provides a stable memo boundary: parent passes pre-built `children`
 * from a `useMemo` so the grid only re-renders when section/form/eval data changes.
 */
const EcrfCrfBody = memo(function EcrfCrfBody({ children }) {
  return children
})

export default EcrfCrfBody
