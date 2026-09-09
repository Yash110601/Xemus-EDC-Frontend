"use client"

import { useCallback, useEffect, useState } from "react"
import PlatformShell from "@/components/platform/PlatformShell"
import { PLATFORM_PRIMARY_BTN } from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import platformService from "@/lib/services/platform.service"
import { Loader2 } from "lucide-react"

export default function PlatformSsoPage() {
  const { studyId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [config, setConfig] = useState({
    isSsoEnabled: false,
    provider: "none",
    entityId: "",
    metadataUrl: "",
    clientId: "",
    tenantId: "",
  })

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    const res = await platformService.getSso(studyId)
    if (res.isSuccess && res.data) {
      setConfig((prev) => ({ ...prev, ...res.data }))
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
    const res = await platformService.saveSso({ studyId, ...config })
    setSaving(false)
    setMessage(res.isSuccess ? "SSO configuration saved (login flow unchanged in preview)." : res.message)
  }

  return (
    <PlatformShell
      title="SSO setup"
      description="SAML 2.0 / OIDC configuration scaffold. Password login remains active — no auth impact until SSO is implemented."
    >
      {!studyId ? (
        <p className="text-sm text-slate-600">Select a study to configure SSO metadata.</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.isSsoEnabled}
              onChange={(e) => setConfig((c) => ({ ...c, isSsoEnabled: e.target.checked }))}
            />
            Enable SSO for this study (preview — does not change login yet)
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-900">Provider</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={config.provider || "none"}
              onChange={(e) => setConfig((c) => ({ ...c, provider: e.target.value }))}
            >
              <option value="none">None</option>
              <option value="saml">SAML 2.0 (Azure AD / Okta)</option>
              <option value="oidc">OpenID Connect</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900">Entity ID / Issuer</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={config.entityId || ""}
              onChange={(e) => setConfig((c) => ({ ...c, entityId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900">Metadata URL</label>
            <input
              type="url"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={config.metadataUrl || ""}
              onChange={(e) => setConfig((c) => ({ ...c, metadataUrl: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900">Client ID</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={config.clientId || ""}
              onChange={(e) => setConfig((c) => ({ ...c, clientId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900">Tenant ID</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={config.tenantId || ""}
              onChange={(e) => setConfig((c) => ({ ...c, tenantId: e.target.value }))}
            />
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={PLATFORM_PRIMARY_BTN}
          >
            {saving ? "Saving…" : "Save SSO config"}
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      )}
    </PlatformShell>
  )
}
