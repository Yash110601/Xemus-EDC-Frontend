"use client"

import { memo } from "react"
import { Lock } from "lucide-react"

function EcrfDbLockBanner({ isLocked, canApplyDbLock, lockMeta, hasPartialFieldLock = false }) {
  if (!isLocked) return null

  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
      role="status"
      aria-live="polite"
      aria-label="Database lock active"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {hasPartialFieldLock ? "Partial database lock — some fields read-only" : "Database lock active — read-only eCRF"}
        </p>
        <p className="mt-0.5 text-xs text-amber-900/80">
          {lockMeta?.level ? `Lock level: ${lockMeta.level}. ` : ""}
          {hasPartialFieldLock
            ? "Locked sections or fields cannot be edited. Other fields remain editable."
            : canApplyDbLock
              ? "This study is locked. You can view data; use Database Lock admin to release when permitted."
              : "This study is locked. CRF fields cannot be edited until the lock is released."}
          {lockMeta?.lockedAt ? ` Locked ${new Date(lockMeta.lockedAt).toLocaleString()}.` : ""}
        </p>
      </div>
    </div>
  )
}

export default memo(EcrfDbLockBanner)
