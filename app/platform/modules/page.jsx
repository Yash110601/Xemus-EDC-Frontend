"use client"

import { useCallback, useEffect, useState } from "react"
import PlatformShell from "@/components/platform/PlatformShell"
import { PLATFORM_PRIMARY_BTN } from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import platformService from "@/lib/services/platform.service"
import { Loader2 } from "lucide-react"

function Toggle({ label, description, checked, disabled, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {description ? <span className="mt-1 block text-xs text-slate-500">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export default function PlatformModulesPage() {
  const { studyId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [config, setConfig] = useState({
    isPlatformEnabled: false,
    isIntegrationHubEnabled: false,
    isSsoEnabled: false,
    isIwrsRtsmEnabled: false,
    isSafetyEnabled: false,
    integrationWebhookUrl: "",
    integrationWebhookSecret: "",
  })

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    setMessage("")
    const res = await platformService.getModules(studyId)
    if (res.isSuccess && res.data) {
      setConfig((prev) => ({
        ...prev,
        ...res.data,
        integrationWebhookSecret: "",
      }))
    } else {
      setMessage(res.message || "Failed to load module configuration.")
    }
    setLoading(false)
  }, [studyId])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!studyId) return
    setSaving(true)
    setMessage("")
    const res = await platformService.saveModules({
      studyId,
      ...config,
    })
    setSaving(false)
    if (res.isSuccess) {
      setMessage("Saved. Enable each module here, then use it from the sidebar.")
      if (res.data) {
        setConfig((prev) => ({ ...prev, ...res.data, integrationWebhookSecret: "" }))
      }
    } else {
      setMessage(res.message || "Save failed.")
    }
  }

  const masterOff = !config.isPlatformEnabled

  return (
    <PlatformShell
      title="Module registry"
      description="Per-study enterprise module toggles. All default off until you enable them for a study."
    >
      {!studyId ? (
        <p className="text-sm text-slate-600">Select a study from the dashboard workspace to configure modules.</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <Toggle
            label="Enable Clinical Platform (master switch)"
            description="Required before any sub-module can activate for this study."
            checked={config.isPlatformEnabled}
            onChange={(v) => setConfig((c) => ({ ...c, isPlatformEnabled: v }))}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Toggle
              label="Integration hub"
              description="Phase 0 — outbound event log + webhooks."
              checked={config.isIntegrationHubEnabled}
              disabled={masterOff}
              onChange={(v) => setConfig((c) => ({ ...c, isIntegrationHubEnabled: v }))}
            />
            <Toggle
              label="SSO (SAML/OIDC)"
              description="Phase 0 — config only; login unchanged until Phase 0 ships."
              checked={config.isSsoEnabled}
              disabled={masterOff}
              onChange={(v) => setConfig((c) => ({ ...c, isSsoEnabled: v }))}
            />
            <Toggle
              label="Enterprise IWRS (RTSM)"
              description="Link this study to Enterprise IWRS. When on, inbound IWRS webhooks are accepted for this study (HMAC via webhook secret below)."
              checked={config.isIwrsRtsmEnabled}
              disabled={masterOff}
              onChange={(v) => setConfig((c) => ({ ...c, isIwrsRtsmEnabled: v }))}
            />
            <Toggle
              label="Safety / SAE"
              description="Phase 4 — preview: SAE workflow, detail edit, regulatory overdue queue."
              checked={config.isSafetyEnabled}
              disabled={masterOff}
              onChange={(v) => setConfig((c) => ({ ...c, isSafetyEnabled: v }))}
            />
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-900">Integration webhook URL</label>
            <input
              type="url"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="https://listener.example/hooks/xemus"
              value={config.integrationWebhookUrl || ""}
              disabled={masterOff}
              onChange={(e) => setConfig((c) => ({ ...c, integrationWebhookUrl: e.target.value }))}
            />
            <label className="block text-sm font-medium text-slate-900">Webhook secret (HMAC)</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={config.hasIntegrationWebhookSecret ? "•••••••• (unchanged if blank)" : "Same secret as IWRS EDC endpoint"}
              value={config.integrationWebhookSecret || ""}
              disabled={masterOff}
              onChange={(e) => setConfig((c) => ({ ...c, integrationWebhookSecret: e.target.value }))}
            />
            <p className="text-xs text-slate-500">
              Used for outbound hub events and for verifying inbound Enterprise IWRS signatures when Enterprise IWRS is enabled.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={PLATFORM_PRIMARY_BTN}
            >
              {saving ? "Saving…" : "Save configuration"}
            </button>
            {message ? <span className="text-sm text-slate-600">{message}</span> : null}
          </div>
        </div>
      )}
    </PlatformShell>
  )
}
