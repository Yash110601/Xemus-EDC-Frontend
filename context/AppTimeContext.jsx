"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import systemService from "@/lib/services/system.service"
import {
  DEFAULT_TIME_CONTEXT,
  getAppTimeContext,
  setAppTimeContext,
  formatAppDateTime,
  formatAppDateOnly,
  columnLabelWithTz,
} from "@/lib/utils/appDateTime"

const AppTimeContext = createContext({
  timeContext: DEFAULT_TIME_CONTEXT,
  displayName: DEFAULT_TIME_CONTEXT.displayName,
  timeZoneId: DEFAULT_TIME_CONTEXT.timeZoneId,
  offset: DEFAULT_TIME_CONTEXT.offset,
  ready: false,
  formatDateTime: (v, opts) => formatAppDateTime(v, opts),
  formatDateOnly: (v) => formatAppDateOnly(v),
  columnLabel: (base) => columnLabelWithTz(base, DEFAULT_TIME_CONTEXT.displayName),
})

export function AppTimeProvider({ children }) {
  const [timeContext, setTimeContext] = useState(() => getAppTimeContext())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await systemService.getTimeContext()
        if (!cancelled && res?.data) {
          setTimeContext(setAppTimeContext(res.data))
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => {
    const displayName = timeContext.displayName || DEFAULT_TIME_CONTEXT.displayName
    return {
      timeContext,
      displayName,
      timeZoneId: timeContext.timeZoneId,
      offset: timeContext.offset,
      ready,
      formatDateTime: (v, opts) =>
        formatAppDateTime(v, { ...opts, displayName, timeZoneId: timeContext.timeZoneId }),
      formatDateOnly: (v) => formatAppDateOnly(v),
      columnLabel: (base) => columnLabelWithTz(base, displayName),
    }
  }, [timeContext, ready])

  return <AppTimeContext.Provider value={value}>{children}</AppTimeContext.Provider>
}

export function useAppTime() {
  return useContext(AppTimeContext)
}

export default AppTimeProvider
