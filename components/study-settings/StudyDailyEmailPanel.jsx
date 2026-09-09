"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { emailTemplateService } from "@/lib/services"
import { cn } from "@/lib/utils"
import {
  Eye,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Send,
  Clock,
  CalendarClock,
  Sparkles,
  FileSpreadsheet,
  Users,
} from "lucide-react"

/** Must match backend `EmailTemplateService.GetDefaultSubjectTemplate()`. */
const BACKEND_MANAGED_SUBJECT = "{{ProtocolNumber}} ({{ProtocolName}}) - PMS Study Updates"
const BACKEND_TEMPLATE_NAME = "Daily Study Update"

const PANEL_CARD =
  "rounded-2xl border border-white/70 bg-white/85 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] backdrop-blur-md ring-1 ring-slate-200/50"

const FIELD_INPUT =
  "mt-2 h-11 w-full rounded-xl border-0 bg-white px-3.5 text-sm shadow-sm ring-1 ring-slate-200/70 transition-all placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:opacity-50"

const FIELD_SELECT =
  "mt-2 flex h-11 w-full appearance-none rounded-xl border-0 bg-white px-3.5 text-sm shadow-sm ring-1 ring-slate-200/70 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/35 disabled:opacity-50"

const SCHEDULE_MODES = [
  { value: 0, label: "Daily" },
  { value: 1, label: "Weekly" },
  { value: 2, label: "Every N days" },
  { value: 3, label: "Monthly" },
  { value: 4, label: "Once" },
]

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

const ANCHOR_TYPES = [
  { value: 0, label: "Study start" },
  { value: 1, label: "First saved" },
  { value: 2, label: "Last sent" },
]

const TIMEZONES = [
  "India Standard Time",
  "UTC",
  "GMT Standard Time",
  "Eastern Standard Time",
  "Central Standard Time",
  "Pacific Standard Time",
]

const DEFAULT_FORM = {
  templateId: null,
  recipients: "",
  ccRecipients: "",
  bccRecipients: "",
  scheduleMode: 0,
  intervalDays: 15,
  weeklyDayOfWeek: 1,
  monthlyDayOfMonth: 1,
  onceSendAtLocal: "",
  scheduleAnchorType: 1,
  timeSlot: "09:00",
  timeZoneId: "India Standard Time",
  attachFinanceStatusReport: false,
  isActive: true,
  lastSentUtc: null,
  nextScheduledRunUtc: null,
}

function pickField(obj, ...keys) {
  if (!obj) return undefined
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function utcToLocalInputValue(utcValue) {
  if (!utcValue) return ""
  const d = new Date(utcValue)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToUtcIso(localValue) {
  if (!localValue) return null
  const d = new Date(localValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function formatUtcDisplay(utcValue) {
  if (!utcValue) return "—"
  const d = new Date(utcValue)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function SectionTitle({ title, subtitle, icon: Icon }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 text-emerald-700 ring-1 ring-emerald-500/15">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  )
}

function MetricChip({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col rounded-2xl bg-white/90 px-3.5 py-3 ring-1 ring-slate-200/60">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function FieldLabel({ children, required = false }) {
  return (
    <Label className="text-[13px] font-semibold text-slate-800">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </Label>
  )
}

function PreviewMetaRow({ label, value }) {
  if (!value?.trim()) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function EmailOutboundPreview({ html }) {
  const frameRef = useRef(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const resize = () => {
      try {
        const doc = frame.contentDocument
        const height = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight
        if (height) frame.style.height = `${Math.min(height + 20, 640)}px`
      } catch {
        frame.style.height = "520px"
      }
    }

    frame.addEventListener("load", resize)
    resize()
    return () => frame.removeEventListener("load", resize)
  }, [html])

  return (
    <iframe
      ref={frameRef}
      title="Outbound email preview"
      srcDoc={html || "<p style='font-family:sans-serif;padding:16px;color:#64748b'>No message content</p>"}
      className="w-full min-h-[360px] rounded-[18px] border-0 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
      sandbox="allow-same-origin"
    />
  )
}

function ToggleCard({ icon: Icon, title, description, checked, onChange, disabled }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/60 transition hover:bg-white",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/60">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      <Checkbox checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-1" />
    </label>
  )
}

function FieldSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading daily email settings">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-[520px] rounded-2xl" />
    </div>
  )
}

export default function StudyDailyEmailPanel({
  studyId,
  canView = false,
  canSave = false,
  canSend = false,
  studyLabel = "",
}) {
  const { toast } = useToast()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [templateExists, setTemplateExists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState({
    subject: "",
    bodyHtml: "",
    to: "",
    cc: "",
    bcc: "",
    attachFinance: false,
  })
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)

  const numericStudyId = useMemo(() => Number.parseInt(String(studyId), 10), [studyId])

  const loadHistory = useCallback(
    async (page = 1) => {
      if (!numericStudyId) return
      setHistoryLoading(true)
      try {
        const res = await emailTemplateService.getSendHistory(numericStudyId, page, 10)
        if (res?.isSuccess) {
          const payload = res.data ?? {}
          const items = pickField(payload, "items", "Items") || []
          setHistory(Array.isArray(items) ? items : [])
          setHistoryPage(pickField(payload, "pageNumber", "PageNumber") || page)
          setHistoryTotalPages(pickField(payload, "totalPages", "TotalPages") || 1)
        } else {
          setHistory([])
        }
      } finally {
        setHistoryLoading(false)
      }
    },
    [numericStudyId],
  )

  const loadTemplate = useCallback(async () => {
    if (!numericStudyId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await emailTemplateService.getByStudyId(numericStudyId)
      if (res?.isSuccess && res.data) {
        const mapped = emailTemplateService.mapTemplateToForm(res.data)
        setForm({
          ...DEFAULT_FORM,
          ...mapped,
          onceSendAtLocal: utcToLocalInputValue(mapped.onceSendAtUtc),
        })
        setTemplateExists(true)
      } else if (res?.statusCode === 404 || res?.httpStatus === 404) {
        setForm({ ...DEFAULT_FORM })
        setTemplateExists(false)
      } else {
        setLoadError(res?.message || "Could not load email configuration.")
        setTemplateExists(false)
      }
      try {
        await loadHistory(1)
      } catch {
        setHistory([])
      }
    } catch (err) {
      setLoadError(err?.message || "Could not load email configuration.")
    } finally {
      setLoading(false)
    }
  }, [numericStudyId, loadHistory])

  useEffect(() => {
    if (!studyId) {
      setForm(DEFAULT_FORM)
      setTemplateExists(false)
      setLoadError(null)
      setHistory([])
      return
    }
    loadTemplate()
  }, [studyId, loadTemplate])

  const buildPayload = useCallback(() => {
    return {
      studyId: numericStudyId,
      templateName: BACKEND_TEMPLATE_NAME,
      subjectTemplate: BACKEND_MANAGED_SUBJECT,
      bodyHtml: null,
      recipients: form.recipients.trim(),
      ccRecipients: form.ccRecipients.trim() || null,
      bccRecipients: form.bccRecipients.trim() || null,
      scheduleMode: form.scheduleMode,
      intervalDays: form.scheduleMode === 2 ? Number(form.intervalDays) || 15 : null,
      weeklyDayOfWeek: form.scheduleMode === 1 ? Number(form.weeklyDayOfWeek) : null,
      monthlyDayOfMonth: form.scheduleMode === 3 ? Number(form.monthlyDayOfMonth) : null,
      onceSendAtUtc: form.scheduleMode === 4 ? localInputToUtcIso(form.onceSendAtLocal) : null,
      scheduleAnchorType: form.scheduleMode === 2 ? form.scheduleAnchorType : 1,
      timeSlot: form.timeSlot,
      timeZoneId: form.timeZoneId,
      attachFinanceStatusReport: form.attachFinanceStatusReport,
      isActive: form.isActive,
    }
  }, [form, numericStudyId])

  const handleSave = async () => {
    if (!form.recipients.trim()) {
      toast({ variant: "destructive", title: "Recipients required", description: "Enter at least one To address." })
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload()
      let res
      if (templateExists && form.templateId) {
        const { studyId: _s, ...updatePayload } = payload
        res = await emailTemplateService.update(form.templateId, updatePayload)
      } else {
        res = await emailTemplateService.create(payload)
      }

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: templateExists ? "Email settings updated" : "Email settings created",
          description: res?.message || "Schedule saved successfully.",
        })
        await loadTemplate()
      } else {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: res?.message || "Could not save email settings.",
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const res = await emailTemplateService.preview({
        studyId: numericStudyId,
      })
      if (res?.isSuccess && res.data) {
        setPreviewData({
          subject: pickField(res.data, "subject", "Subject") || "",
          bodyHtml: pickField(res.data, "bodyHtml", "BodyHtml") || "",
          to: form.recipients || "",
          cc: form.ccRecipients || "",
          bcc: form.bccRecipients || "",
          attachFinance: Boolean(form.attachFinanceStatusReport),
        })
      } else {
        setPreviewData({
          subject: "",
          bodyHtml: "",
          to: form.recipients || "",
          cc: form.ccRecipients || "",
          bcc: form.bccRecipients || "",
          attachFinance: Boolean(form.attachFinanceStatusReport),
        })
        toast({
          variant: "destructive",
          title: "Preview failed",
          description: res?.message || "Could not generate preview.",
        })
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSendNow = async () => {
    setSending(true)
    try {
      const res = await emailTemplateService.sendNow(numericStudyId, true)
      if (res?.isSuccess) {
        const sent = pickField(res.data, "sent", "Sent") ?? 0
        const total = pickField(res.data, "total", "Total") ?? 0
        toast({
          variant: sent > 0 ? "success" : "destructive",
          title: sent > 0 ? "Email sent" : "Send completed",
          description: res?.message || `Sent ${sent} of ${total} email(s).`,
        })
        await loadTemplate()
        await loadHistory(1)
      } else {
        toast({
          variant: "destructive",
          title: "Send failed",
          description: res?.message || "Could not send email.",
        })
      }
    } finally {
      setSending(false)
      setSendConfirmOpen(false)
    }
  }

  if (!canView) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-8 text-center text-sm text-amber-800 ring-1 ring-amber-200/60">
        You do not have permission to view daily email settings.
      </p>
    )
  }

  if (loading) {
    return <FieldSkeleton />
  }

  if (loadError) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-red-50/80 px-6 py-10 text-center ring-1 ring-red-200/70" role="alert">
        <p className="text-sm font-semibold text-red-800">{loadError}</p>
        <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={loadTemplate}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Status strip */}
      <div className={cn(PANEL_CARD, "p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle
            icon={Mail}
            title="Study update email"
            subtitle={
              studyLabel
                ? `Automated updates for ${studyLabel}`
                : "Configure who receives study updates and when they are sent"
            }
          />
          <span
            className={cn(
              "inline-flex shrink-0 items-center self-start rounded-full px-3 py-1.5 text-xs font-semibold ring-1 lg:self-center",
              templateExists
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                : "bg-amber-50 text-amber-800 ring-amber-200/80",
            )}
          >
            {templateExists ? "Active configuration" : "Draft — save to enable"}
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          Scheduled at <strong>{form.timeSlot || "09:00"}</strong> ({form.timeZoneId || "India Standard Time"}) for
          active studies. Template: <strong>{BACKEND_TEMPLATE_NAME}</strong> — fixed by backend.
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricChip icon={Clock} label="Last sent" value={formatUtcDisplay(form.lastSentUtc)} />
          <MetricChip icon={CalendarClock} label="Next run" value={formatUtcDisplay(form.nextScheduledRunUtc)} />
          <MetricChip
            icon={Sparkles}
            label="Schedule"
            value={SCHEDULE_MODES.find((m) => m.value === form.scheduleMode)?.label || "Daily"}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Compose */}
        <div className={cn(PANEL_CARD, "space-y-5 p-4 sm:p-5 xl:col-span-7")}>
          <SectionTitle
            icon={Users}
            title="Recipients"
            subtitle="Comma or semicolon separated addresses"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel required>To</FieldLabel>
              <Input
                value={form.recipients}
                onChange={(e) => setForm((p) => ({ ...p, recipients: e.target.value }))}
                placeholder="crc@site.com; monitor@cro.com"
                disabled={!canSave}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <FieldLabel>CC</FieldLabel>
              <Input
                value={form.ccRecipients}
                onChange={(e) => setForm((p) => ({ ...p, ccRecipients: e.target.value }))}
                placeholder="Optional"
                disabled={!canSave}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <FieldLabel>BCC</FieldLabel>
              <Input
                value={form.bccRecipients}
                onChange={(e) => setForm((p) => ({ ...p, bccRecipients: e.target.value }))}
                placeholder="Optional"
                disabled={!canSave}
                className={FIELD_INPUT}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Template</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{BACKEND_TEMPLATE_NAME}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Subject and message content are managed by the backend. Use <strong>Preview</strong> to see the exact
              outbound email with live study data.
            </p>
          </div>
        </div>

        {/* Schedule + options */}
        <div className="space-y-4 xl:col-span-5">
          <div className={cn(PANEL_CARD, "space-y-4 p-4 sm:p-5")}>
            <SectionTitle
              icon={CalendarClock}
              title="Delivery schedule"
              subtitle="Only active studies receive automated emails"
            />

            <div className="space-y-4">
              <div>
                <FieldLabel required>Frequency</FieldLabel>
                <select
                  value={form.scheduleMode}
                  onChange={(e) => setForm((p) => ({ ...p, scheduleMode: Number(e.target.value) }))}
                  disabled={!canSave}
                  className={FIELD_SELECT}
                >
                  {SCHEDULE_MODES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel required>Time</FieldLabel>
                  <Input
                    type="time"
                    value={form.timeSlot}
                    onChange={(e) => setForm((p) => ({ ...p, timeSlot: e.target.value }))}
                    disabled={!canSave}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <FieldLabel required>Timezone</FieldLabel>
                  <select
                    value={form.timeZoneId}
                    onChange={(e) => setForm((p) => ({ ...p, timeZoneId: e.target.value }))}
                    disabled={!canSave}
                    className={FIELD_SELECT}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.scheduleMode === 1 && (
                <div>
                  <FieldLabel>Day of week</FieldLabel>
                  <select
                    value={form.weeklyDayOfWeek}
                    onChange={(e) => setForm((p) => ({ ...p, weeklyDayOfWeek: Number(e.target.value) }))}
                    disabled={!canSave}
                    className={FIELD_SELECT}
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.scheduleMode === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Every N days</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={form.intervalDays}
                      onChange={(e) => setForm((p) => ({ ...p, intervalDays: e.target.value }))}
                      disabled={!canSave}
                      className={FIELD_INPUT}
                    />
                  </div>
                  <div>
                    <FieldLabel>Count from</FieldLabel>
                    <select
                      value={form.scheduleAnchorType}
                      onChange={(e) => setForm((p) => ({ ...p, scheduleAnchorType: Number(e.target.value) }))}
                      disabled={!canSave}
                      className={FIELD_SELECT}
                    >
                      {ANCHOR_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {form.scheduleMode === 3 && (
                <div>
                  <FieldLabel>Day of month</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.monthlyDayOfMonth}
                    onChange={(e) => setForm((p) => ({ ...p, monthlyDayOfMonth: e.target.value }))}
                    disabled={!canSave}
                    className={FIELD_INPUT}
                  />
                </div>
              )}

              {form.scheduleMode === 4 && (
                <div>
                  <FieldLabel>Send once at</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={form.onceSendAtLocal}
                    onChange={(e) => setForm((p) => ({ ...p, onceSendAtLocal: e.target.value }))}
                    disabled={!canSave}
                    className={FIELD_INPUT}
                  />
                </div>
              )}
            </div>
          </div>

          <div className={cn(PANEL_CARD, "space-y-3 p-4 sm:p-5")}>
            <SectionTitle icon={Sparkles} title="Options" />
            <ToggleCard
              icon={FileSpreadsheet}
              title="Attach finance status"
              description="Include Study Finance Status Excel with each send"
              checked={form.attachFinanceStatusReport}
              onChange={(v) => setForm((p) => ({ ...p, attachFinanceStatusReport: Boolean(v) }))}
              disabled={!canSave}
            />
            <ToggleCard
              icon={Sparkles}
              title="Schedule enabled"
              description="Turn off to pause automated sends without deleting settings"
              checked={form.isActive}
              onChange={(v) => setForm((p) => ({ ...p, isActive: Boolean(v) }))}
              disabled={!canSave}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={cn(PANEL_CARD, "flex flex-col-reverse gap-2 p-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:p-4")}>
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={!numericStudyId}
          className="h-11 rounded-xl border-slate-200 bg-white"
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSendConfirmOpen(true)}
          disabled={!canSend || !templateExists || sending}
          className="h-11 rounded-xl border-slate-200 bg-white"
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send now
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-6 text-white shadow-md shadow-emerald-500/20"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {templateExists ? "Save changes" : "Save configuration"}
        </Button>
      </div>

      {/* History */}
      <div className={cn(PANEL_CARD, "p-4 sm:p-5")}>
        <SectionTitle title="Send history" subtitle="Recent delivery attempts for this study" />
        {historyLoading ? (
          <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading send history">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl bg-slate-50/80 px-4 py-8 text-center ring-1 ring-slate-200/60">
            <p className="text-sm font-medium text-slate-600">No emails sent yet</p>
            <p className="mt-1 text-xs text-slate-400">History appears after the first scheduled or manual send.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((row) => {
              const id = pickField(row, "id", "Id")
              const status = pickField(row, "status", "Status") || "—"
              return (
                <div
                  key={id}
                  className="flex flex-col gap-2 rounded-2xl bg-slate-50/70 px-4 py-3 ring-1 ring-slate-200/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {pickField(row, "subject", "Subject") || "—"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {pickField(row, "toAddresses", "ToAddresses") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                    <span>{formatUtcDisplay(pickField(row, "createdAtUtc", "CreatedAtUtc"))}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        status === "Sent"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "Failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-200 text-slate-700",
                      )}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              )
            })}
            {historyTotalPages > 1 && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={historyPage <= 1 || historyLoading}
                  onClick={() => loadHistory(historyPage - 1)}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-500">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={historyPage >= historyTotalPages || historyLoading}
                  onClick={() => loadHistory(historyPage + 1)}
                  className="rounded-xl"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          overlayClassName="bg-black/70 backdrop-blur-[2px]"
          className="max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
        >
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-slate-900">Outbound email preview</DialogTitle>
            <p className="text-sm text-slate-500">
              Exactly what will be sent — recipients from your form, subject and body with live study data filled in.
            </p>
          </DialogHeader>
          <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto bg-white px-6 py-4 custom-scrollbar-light">
            {previewLoading ? (
              <div className="space-y-3" role="status" aria-busy="true" aria-label="Generating preview">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-56 w-full rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PreviewMetaRow label="To" value={previewData.to} />
                    <PreviewMetaRow label="CC" value={previewData.cc} />
                    <PreviewMetaRow label="BCC" value={previewData.bcc} />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attachment</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">
                        {previewData.attachFinance
                          ? "Study Finance Status Excel (.xlsx)"
                          : "None"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{previewData.subject || "—"}</p>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Message body</p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f5f9] p-4 shadow-sm">
                    <EmailOutboundPreview html={previewData.bodyHtml} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send email now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the study update email immediately, even if one was already sent today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendNow} disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
