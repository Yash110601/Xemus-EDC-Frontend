"use client"

import { useCallback, useEffect, useState } from "react"
import EConsentShell from "@/components/econsent/EConsentShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import eConsentService from "@/lib/services/eConsent.service"
import { EC_CARD, EC_CHECK_ROW, EC_SECTION_HEAD } from "@/lib/econsent/econsentUi"
import { toast } from "sonner"
import { Camera, FilePenLine, KeyRound, Loader2, Save, Video, Webhook } from "lucide-react"

const OPTIONS = [
  {
    key: "allowOtp",
    label: "OTP verification",
    hint: "Require a one-time code before the signature can be submitted.",
    icon: KeyRound,
  },
  {
    key: "allowPhoto",
    label: "Photo evidence",
    hint: "Allow capturing a photo of the signer or consent document.",
    icon: Camera,
  },
  {
    key: "allowVideo",
    label: "Video evidence",
    hint: "Allow a short video confirmation during the signing step.",
    icon: Video,
  },
  {
    key: "allowSignature",
    label: "Drawn / uploaded signature",
    hint: "Collect an on-screen signature pad capture from the participant.",
    icon: FilePenLine,
  },
]

export default function EConsentSetupPage() {
  const { studyId } = useStudyEConsentRequired()
  const [setup, setSetup] = useState({
    allowOtp: true,
    allowPhoto: false,
    allowVideo: false,
    allowSignature: true,
    webhookUrl: "",
    webhookSecret: "",
    allowPublishWithoutIrb: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    try {
      const res = await eConsentService.getSetup(studyId)
      if (res?.isSuccess && res.data) {
        setSetup({
          allowOtp: Boolean(res.data.allowOtp),
          allowPhoto: Boolean(res.data.allowPhoto),
          allowVideo: Boolean(res.data.allowVideo),
          allowSignature: Boolean(res.data.allowSignature),
          webhookUrl: res.data.webhookUrl || "",
          webhookSecret: "",
          allowPublishWithoutIrb: Boolean(res.data.allowPublishWithoutIrb),
        })
      } else {
        toast.error(res?.message || "Failed to load eCONSENT setup")
      }
    } catch {
      toast.error("Failed to load eCONSENT setup")
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!studyId) return
    setSaving(true)
    try {
      const body = {
        studyId,
        allowOtp: setup.allowOtp,
        allowPhoto: setup.allowPhoto,
        allowVideo: setup.allowVideo,
        allowSignature: setup.allowSignature,
        webhookUrl: setup.webhookUrl || null,
        allowPublishWithoutIrb: setup.allowPublishWithoutIrb,
      }
      if (setup.webhookSecret.trim()) body.webhookSecret = setup.webhookSecret.trim()
      const res = await eConsentService.saveSetup(body)
      if (res?.isSuccess) toast.success("eCONSENT setup saved")
      else toast.error(res?.message || "Save failed")
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <EConsentShell
      title="Verification setup"
      description="Identity steps, IRB publish gate, and outbound integration-hub webhooks."
    >
      <div className="space-y-4">
        <div className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">Allowed verification methods</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              These flags apply to participant signing for this study.
            </p>
          </div>

          <div className="space-y-3 p-5 sm:p-6">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading setup…
              </p>
            ) : (
              <>
                {OPTIONS.map(({ key, label, hint, icon: Icon }) => (
                  <label key={key} className={`${EC_CHECK_ROW} cursor-pointer`}>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={Boolean(setup[key])}
                      onChange={(e) => setSetup((p) => ({ ...p, [key]: e.target.checked }))}
                    />
                    <span className="mt-0.5 rounded-lg bg-white p-2 text-emerald-700 ring-1 ring-slate-200/80">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{label}</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        <div className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">IRB & integrations</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Governance gate before publishing, plus lifecycle events for integration-hub listeners.
            </p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            {loading ? null : (
              <>
                <label className={`${EC_CHECK_ROW} cursor-pointer`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={setup.allowPublishWithoutIrb}
                    onChange={(e) => setSetup((p) => ({ ...p, allowPublishWithoutIrb: e.target.checked }))}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">Allow publish without IRB</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Bypass the IRB approval check when publishing consent versions (use carefully).
                    </span>
                  </span>
                </label>

                <div>
                  <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Webhook className="h-3.5 w-3.5" /> Webhook URL
                  </label>
                  <Input
                    placeholder="https://listener.example/hooks/econsent"
                    value={setup.webhookUrl}
                    onChange={(e) => setSetup((p) => ({ ...p, webhookUrl: e.target.value }))}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Events: FormVersionPublished, PartySigned, ConsentApproved, ConsentWithdrawn, WetInkUploaded
                  </p>
                </div>
                <div>
                  <label className="mb-1 text-xs font-semibold text-slate-700">Webhook secret (optional)</label>
                  <Input
                    type="password"
                    placeholder="Leave blank to keep existing secret"
                    value={setup.webhookSecret}
                    onChange={(e) => setSetup((p) => ({ ...p, webhookSecret: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="brand"
                className="rounded-lg px-5"
                onClick={handleSave}
                disabled={saving || !studyId || loading}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save setup
              </Button>
            </div>
          </div>
        </div>
      </div>
    </EConsentShell>
  )
}
