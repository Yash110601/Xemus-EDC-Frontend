"use client"

import { useCallback, useEffect, useRef } from "react"

export default function useAuditRetryQueue({ saveFieldChange, onRetryExhausted }) {
  const auditRetryQueueRef = useRef([])
  const auditRetryTimerRef = useRef(null)

  const isAuditStatusRetryable = useCallback((statusCode) => {
    const code = Number.parseInt(String(statusCode ?? ""), 10)
    if (!Number.isFinite(code) || code <= 0) return true
    if (code === 408 || code === 429) return true
    return code >= 500
  }, [])

  const isNoChangeAuditError = useCallback((statusCode, message) => {
    const code = Number.parseInt(String(statusCode ?? ""), 10)
    const text = String(message || "").toLowerCase()
    if (code !== 400) return false
    return text.includes("oldvalue") && text.includes("newvalue") && text.includes("same")
  }, [])

  const enqueueAuditRetryBatch = useCallback(
    (failedEntries = []) => {
      const validEntries = Array.isArray(failedEntries)
        ? failedEntries.filter((entry) => entry?.payload && typeof entry.payload === "object")
        : []
      if (validEntries.length === 0) return
      validEntries.forEach((entry) => {
        auditRetryQueueRef.current.push({
          payload: entry.payload,
          retryCount: Number(entry?.retryCount || 0),
        })
      })

      const schedule = (delayMs = 1800) => {
        if (auditRetryTimerRef.current) return
        auditRetryTimerRef.current = setTimeout(async () => {
          auditRetryTimerRef.current = null
          const queueSnapshot = Array.isArray(auditRetryQueueRef.current) ? [...auditRetryQueueRef.current] : []
          auditRetryQueueRef.current = []
          if (queueSnapshot.length === 0) return

          const maxAttempts = 3
          const settled = await Promise.allSettled(
            queueSnapshot.map((entry) => saveFieldChange(entry.payload)),
          )

          const retryAgain = []
          let droppedCount = 0
          settled.forEach((result, idx) => {
            const entry = queueSnapshot[idx]
            const success = result.status === "fulfilled" && Boolean(result.value?.isSuccess)
            if (success) return
            const statusCode =
              result.status === "fulfilled" ? result.value?.statusCode || result.value?.httpStatus : 0
            const nextRetryCount = Number(entry?.retryCount || 0) + 1
            if (isAuditStatusRetryable(statusCode) && nextRetryCount < maxAttempts) {
              retryAgain.push({ payload: entry.payload, retryCount: nextRetryCount })
              return
            }
            droppedCount += 1
          })

          if (retryAgain.length > 0) {
            auditRetryQueueRef.current.push(...retryAgain)
            schedule(2200)
          }
          if (droppedCount > 0 && typeof onRetryExhausted === "function") {
            onRetryExhausted(droppedCount)
          }
        }, delayMs)
      }
      schedule(1800)
    },
    [isAuditStatusRetryable, onRetryExhausted, saveFieldChange],
  )

  useEffect(() => {
    return () => {
      if (auditRetryTimerRef.current) {
        clearTimeout(auditRetryTimerRef.current)
        auditRetryTimerRef.current = null
      }
    }
  }, [])

  return {
    isAuditStatusRetryable,
    isNoChangeAuditError,
    enqueueAuditRetryBatch,
  }
}
