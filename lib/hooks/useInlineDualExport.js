"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Per-format loading for in-page CSV/PDF (or similar) exports that `await` the network
 * directly — avoids one shared boolean showing spinners on both buttons.
 *
 * Job-based exports (`useReportExportJobs` + `csvRunning` / `pdfRunning`) do not need this.
 *
 * @returns {{ exportingFormat: null | string, executeExport: (format: string, work: () => Promise<unknown>) => Promise<void> }}
 */
export function useInlineDualExport() {
  const [exportingFormat, setExportingFormat] = useState(null)
  const inFlightRef = useRef(false)

  const executeExport = useCallback(async (format, work) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setExportingFormat(format)
    try {
      await work()
    } finally {
      inFlightRef.current = false
      setExportingFormat(null)
    }
  }, [])

  return { exportingFormat, executeExport }
}
