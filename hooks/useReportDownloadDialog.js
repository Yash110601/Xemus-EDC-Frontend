"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

/**
 * Shared open/download state for ReportDownloadDialog across report pages.
 *
 * @param {{
 *   assertCanExport?: () => boolean,
 *   onExport: (opts: object) => void | Promise<any>,
 *   closeOnStart?: boolean,
 * }} options
 */
export function useReportDownloadDialog({
  assertCanExport,
  onExport,
  closeOnStart = true,
} = {}) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const openDownload = useCallback(() => {
    if (typeof assertCanExport === "function" && !assertCanExport()) return
    setDownloadOpen(true)
  }, [assertCanExport])

  const handleDownload = useCallback(
    async (opts) => {
      if (typeof assertCanExport === "function" && !assertCanExport()) return
      if (typeof onExport !== "function") {
        toast.error("Download is not configured.")
        return undefined
      }
      setDownloading(true)
      try {
        const result = await onExport(opts)
        // Email flow keeps the dialog open until Send finishes in ReportDownloadDialog.
        if (closeOnStart && !opts?.asAttachment && opts?.delivery !== "email") {
          setDownloadOpen(false)
        }
        return result
      } finally {
        setDownloading(false)
      }
    },
    [assertCanExport, onExport, closeOnStart],
  )

  return {
    downloadOpen,
    setDownloadOpen,
    downloading,
    openDownload,
    handleDownload,
  }
}
