"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { isValidEmail } from "@/lib/utils/emailValidation"
import reportsService from "@/lib/services/reports.service"
import { toast } from "sonner"
import {
  Archive,
  Braces,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sheet,
} from "lucide-react"

const ALL_FORMATS = [
  { id: "csv", label: "CSV", Icon: FileSpreadsheet },
  { id: "html", label: "HTML", Icon: Braces },
  { id: "excel", label: "Excel", Icon: Sheet },
  { id: "pdf", label: "PDF", Icon: FileText },
  { id: "zip", label: "ZIP", Icon: Archive },
]

const PAGE_SIZES = ["Letter", "Legal", "Tabloid", "A4", "A3"]
const ORIENTATIONS = [
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
]

function parseEmailList(value) {
  if (!value || !String(value).trim()) return []
  return String(value)
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)
}

function validateEmailFields({ to, cc, bcc }) {
  const toList = parseEmailList(to)
  if (toList.length === 0) {
    return "Enter at least one recipient in To."
  }
  for (const email of toList) {
    if (!isValidEmail(email)) return `Invalid To address: ${email}`
  }
  for (const email of parseEmailList(cc)) {
    if (!isValidEmail(email)) return `Invalid Cc address: ${email}`
  }
  for (const email of parseEmailList(bcc)) {
    if (!isValidEmail(email)) return `Invalid Bcc address: ${email}`
  }
  return null
}

/**
 * Shared report download dialog (format tiles, PDF options, accessibility, email).
 * Download uses onDownload; Send as Email builds an attachment via onDownload({ asAttachment: true })
 * then POSTs it to /Reports/send-export-email.
 *
 * @param {string[]} [enabledFormats] - Formats that can be downloaded (others show "Soon").
 */
export default function ReportDownloadDialog({
  open,
  onOpenChange,
  title = "Download",
  defaultSubject = "Report",
  defaultFormat = "pdf",
  defaultPageSize = "A4",
  defaultOrientation = "landscape",
  enabledFormats = ["csv", "html", "excel", "pdf"],
  canExport = true,
  downloading = false,
  onDownload,
}) {
  const formats = ALL_FORMATS.map((f) => ({
    ...f,
    enabled: enabledFormats.includes(f.id),
  }))

  const initialFormat = formats.some((f) => f.id === defaultFormat && f.enabled)
    ? defaultFormat
    : formats.find((f) => f.enabled)?.id || "pdf"

  const [format, setFormat] = useState(initialFormat)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [orientation, setOrientation] = useState(defaultOrientation)
  const [includeAccessibility, setIncludeAccessibility] = useState(true)
  const [sendAsEmail, setSendAsEmail] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [emailCc, setEmailCc] = useState("")
  const [emailBcc, setEmailBcc] = useState("")
  const [emailSubject, setEmailSubject] = useState(defaultSubject)
  const [emailBody, setEmailBody] = useState("See attached")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    const nextFormat = formats.some((f) => f.id === defaultFormat && f.enabled)
      ? defaultFormat
      : formats.find((f) => f.enabled)?.id || "pdf"
    setFormat(nextFormat)
    setPageSize(defaultPageSize)
    setOrientation(defaultOrientation)
    setIncludeAccessibility(true)
    setSendAsEmail(false)
    setEmailTo("")
    setEmailCc("")
    setEmailBcc("")
    setEmailSubject(defaultSubject)
    setEmailBody("See attached")
    setSending(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formats derived from enabledFormats
  }, [open, defaultFormat, defaultPageSize, defaultOrientation, defaultSubject, enabledFormats])

  const isPdf = format === "pdf"
  const formatMeta = formats.find((f) => f.id === format)
  const formatEnabled = Boolean(formatMeta?.enabled)
  const busy = downloading || sending

  const handlePrimary = async () => {
    if (!canExport) {
      toast.error("You do not have permission to export.")
      return
    }
    if (!formatEnabled) {
      toast.message("Format coming soon", {
        description: `${formatMeta?.label || format} export is not available yet.`,
      })
      return
    }
    if (typeof onDownload !== "function") {
      toast.error("Download is not configured.")
      return
    }

    const baseOpts = {
      format,
      pageSize: isPdf ? pageSize : undefined,
      orientation: isPdf ? orientation : undefined,
      includeAccessibility: isPdf ? includeAccessibility : undefined,
    }

    if (sendAsEmail) {
      const emailError = validateEmailFields({
        to: emailTo,
        cc: emailCc,
        bcc: emailBcc,
      })
      if (emailError) {
        toast.error(emailError)
        return
      }

      setSending(true)
      try {
        const prepared = await onDownload({
          ...baseOpts,
          asAttachment: true,
          delivery: "email",
          email: {
            to: emailTo.trim(),
            cc: emailCc.trim(),
            bcc: emailBcc.trim(),
            subject: emailSubject.trim() || defaultSubject,
            body: emailBody.trim() || "See attached",
          },
        })

        const blob = prepared?.blob
        const fileName = prepared?.fileName || prepared?.filename
        if (!blob) {
          toast.error("Could not prepare the attachment for email.", {
            description: "This report does not support email with attachment yet.",
          })
          return
        }

        await reportsService.sendExportEmail({
          to: emailTo.trim(),
          cc: emailCc.trim(),
          bcc: emailBcc.trim(),
          subject: emailSubject.trim() || defaultSubject,
          body: emailBody.trim() || "See attached",
          blob,
          fileName: fileName || `report.${format === "excel" ? "xlsx" : format}`,
        })

        toast.success("Report emailed successfully", {
          description: `Sent to ${emailTo.trim()} with attachment.`,
        })
        onOpenChange?.(false)
      } catch (error) {
        toast.error(error?.message || "Failed to send email.")
      } finally {
        setSending(false)
      }
      return
    }

    try {
      await onDownload({
        ...baseOpts,
        asAttachment: false,
        delivery: "download",
      })
    } catch (error) {
      toast.error(error?.message || "Download failed.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90dvh,40rem)] max-w-lg gap-0 overflow-y-auto border-slate-200 bg-white p-0 opacity-100 sm:max-w-xl"
        overlayClassName="bg-black/70 opacity-100 backdrop-blur-[2px]"
        showCloseButton
      >
        <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose report format and download options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2.5 text-sm font-medium text-slate-600">Choose report format</p>
            <div className="grid grid-cols-5 gap-2">
              {formats.map(({ id, label, Icon, enabled }) => {
                const selected = format === id
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return
                      setFormat(id)
                    }}
                    title={enabled ? undefined : `${label} export coming soon`}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition",
                      selected
                        ? "border-emerald-400 bg-emerald-50 shadow-[inset_0_3px_0_0_rgb(16,185,129)]"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                      !enabled &&
                        "cursor-not-allowed opacity-55 hover:border-slate-200 hover:bg-white",
                    )}
                    aria-pressed={selected}
                    aria-disabled={!enabled}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        selected ? "text-emerald-700" : "text-slate-500",
                        !enabled && "text-slate-400",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        selected ? "text-emerald-900" : "text-slate-700",
                        !enabled && "text-slate-400",
                      )}
                    >
                      {label}
                    </span>
                    {!enabled ? (
                      <span className="absolute right-1 top-1 rounded bg-slate-100 px-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">
                        Soon
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {isPdf ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-600">Page size</Label>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="h-10 w-full border-slate-200 bg-white">
                    <SelectValue placeholder="Page size" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper">
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-600">Page orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger className="h-10 w-full border-slate-200 bg-white">
                    <SelectValue placeholder="Orientation" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper">
                    {ORIENTATIONS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
            {isPdf ? (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="report-a11y-toggle" className="text-sm font-medium text-slate-700">
                  Include Accessibility Tags
                </Label>
                <Switch
                  id="report-a11y-toggle"
                  checked={includeAccessibility}
                  onCheckedChange={setIncludeAccessibility}
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="report-email-toggle" className="text-sm font-medium text-slate-700">
                  Send as Email
                </Label>
                <p className="text-[11px] text-slate-500">Emails the selected format as an attachment</p>
              </div>
              <Switch
                id="report-email-toggle"
                checked={sendAsEmail}
                onCheckedChange={setSendAsEmail}
              />
            </div>
          </div>

          {sendAsEmail ? (
            <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3.5">
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">To</Label>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="h-10 border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-600">Cc</Label>
                  <Input
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    className="h-10 border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-600">Bcc</Label>
                  <Input
                    value={emailBcc}
                    onChange={(e) => setEmailBcc(e.target.value)}
                    className="h-10 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="h-10 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-slate-600">Body</Label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={busy}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handlePrimary()}
            disabled={busy || !canExport || !formatEnabled}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
            title={!formatEnabled ? "Format coming soon" : undefined}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {sendAsEmail ? "Sending…" : "Preparing…"}
              </>
            ) : sendAsEmail ? (
              "Send"
            ) : (
              "Download"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
