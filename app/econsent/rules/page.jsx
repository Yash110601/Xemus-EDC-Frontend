"use client"

import { useCallback, useEffect, useState } from "react"
import EConsentShell from "@/components/econsent/EConsentShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import eConsentService from "@/lib/services/eConsent.service"
import {
  EC_CARD,
  EC_CHECK_ROW,
  EC_EMPTY,
  EC_FIELD,
  EC_LABEL,
  EC_SECTION_HEAD,
} from "@/lib/econsent/econsentUi"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"

const EMPTY = {
  jurisdictionCode: "IN",
  name: "India",
  ageOfMajority: 18,
  requireDualParentBelowAge: 12,
  assentRequiredFromAge: 7,
  assentRequiredToAge: 17,
  requireWitness: false,
  requireInvestigatorCountersign: false,
  allowOtp: true,
  allowSmsOtp: false,
  allowInClinicAttestation: true,
  allowPhoto: false,
  allowVideo: false,
  allowSignature: true,
}

export default function EConsentRulesPage() {
  const { studyId } = useStudyEConsentRequired()
  const [profiles, setProfiles] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [forms, setForms] = useState([])
  const [assignments, setAssignments] = useState([])
  const [assignFormId, setAssignFormId] = useState("")
  const [assignSaving, setAssignSaving] = useState(false)

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    try {
      const [jurRes, formsRes, assignRes] = await Promise.all([
        eConsentService.getJurisdictions(studyId),
        eConsentService.getForms(studyId),
        eConsentService.getAssignments(studyId),
      ])
      if (jurRes?.isSuccess && Array.isArray(jurRes.data)) setProfiles(jurRes.data)
      else setProfiles([])
      if (formsRes?.isSuccess && Array.isArray(formsRes.data)) setForms(formsRes.data)
      else setForms([])
      if (assignRes?.isSuccess && Array.isArray(assignRes.data)) setAssignments(assignRes.data)
      else setAssignments([])
      if (!jurRes?.isSuccess && !formsRes?.isSuccess && !assignRes?.isSuccess) {
        toast.error(jurRes?.message || formsRes?.message || assignRes?.message || "Failed to load rules")
      }
    } catch {
      setProfiles([])
      setForms([])
      setAssignments([])
      toast.error("Failed to load jurisdiction rules")
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
      const res = await eConsentService.saveJurisdiction({ ...form, studyId })
      if (res?.isSuccess) {
        toast.success("Jurisdiction rules saved")
        await load()
      } else {
        toast.error(res?.message || "Save failed")
      }
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <EConsentShell
      title="Jurisdiction & age rules"
      description="Age bands and signing requirements drive who must consent. Assign which form applies to the study."
    >
      <div className="space-y-5">
        <section className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">Jurisdiction profile</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Majority age, dual-parent rules, and assent band for this region.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <label className={EC_LABEL}>Jurisdiction code</label>
              <Input
                className={EC_FIELD}
                value={form.jurisdictionCode}
                onChange={(e) => setForm((p) => ({ ...p, jurisdictionCode: e.target.value.toUpperCase() }))}
                placeholder="IN"
              />
            </div>
            <div>
              <label className={EC_LABEL}>Display name</label>
              <Input
                className={EC_FIELD}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={EC_LABEL}>Age of majority</label>
              <Input
                className={EC_FIELD}
                type="number"
                value={form.ageOfMajority}
                onChange={(e) => setForm((p) => ({ ...p, ageOfMajority: Number(e.target.value) || 18 }))}
              />
            </div>
            <div>
              <label className={EC_LABEL}>Dual parent below age</label>
              <Input
                className={EC_FIELD}
                type="number"
                value={form.requireDualParentBelowAge ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    requireDualParentBelowAge: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label className={EC_LABEL}>Assent from age</label>
              <Input
                className={EC_FIELD}
                type="number"
                value={form.assentRequiredFromAge ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    assentRequiredFromAge: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className={EC_LABEL}>Assent to age</label>
              <Input
                className={EC_FIELD}
                type="number"
                value={form.assentRequiredToAge ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    assentRequiredToAge: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>

            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["requireWitness", "Require witness"],
                ["requireInvestigatorCountersign", "Investigator countersign"],
                ["allowOtp", "Allow email OTP"],
                ["allowSmsOtp", "Allow SMS OTP"],
                ["allowInClinicAttestation", "Allow in-clinic identity attestation"],
                ["allowPhoto", "Allow photo"],
                ["allowVideo", "Allow video"],
                ["allowSignature", "Allow signature"],
              ].map(([key, label]) => (
                <label key={key} className={`${EC_CHECK_ROW} cursor-pointer`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={Boolean(form[key])}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end sm:col-span-2">
              <Button
                type="button"
                variant="brand"
                className="rounded-lg px-5"
                onClick={handleSave}
                disabled={saving || !studyId}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save jurisdiction profile
              </Button>
            </div>
          </div>
        </section>

        <section className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">Form assignment</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Which approved consent form applies for this study (site/visit scoping can be refined later).
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className={EC_LABEL}>Consent form</label>
                <select
                  className={EC_FIELD}
                  value={assignFormId}
                  onChange={(e) => setAssignFormId(e.target.value)}
                >
                  <option value="">Select form…</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="brand"
                className="rounded-lg"
                disabled={assignSaving || !studyId || !assignFormId}
                onClick={async () => {
                  setAssignSaving(true)
                  try {
                    const res = await eConsentService.saveAssignment({
                      studyId,
                      formId: Number(assignFormId),
                      siteId: null,
                      visitScheduleId: null,
                    })
                    if (res?.isSuccess) {
                      toast.success("Assignment saved")
                      setAssignFormId("")
                      await load()
                    } else toast.error(res?.message || "Save failed")
                  } finally {
                    setAssignSaving(false)
                  }
                }}
              >
                {assignSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save assignment
              </Button>
            </div>

            {assignments.length === 0 ? (
              <div className={EC_EMPTY}>
                <p className="font-medium text-slate-700">No form assignments yet</p>
                <p>Select an approved form above to attach it to this study.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      <span className="font-semibold text-slate-900">{a.formName || `Form #${a.formId}`}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {a.siteId ? `Site #${a.siteId}` : "All sites"}
                        {a.visitScheduleId ? ` · Visit #${a.visitScheduleId}` : " · Study-wide"}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      onClick={async () => {
                        const res = await eConsentService.deleteAssignment(a.id)
                        if (res?.isSuccess) {
                          toast.success("Assignment removed")
                          await load()
                        } else toast.error(res?.message || "Delete failed")
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">Saved profiles</h2>
          </div>
          <div className="p-5 sm:p-6">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading…
              </p>
            ) : profiles.length === 0 ? (
              <div className={EC_EMPTY}>
                <p className="font-medium text-slate-700">No profiles yet</p>
                <p>Save a jurisdiction profile above to get started.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {profiles.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-sm">
                    <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      {p.jurisdictionCode}
                    </span>
                    <span className="ml-2 font-semibold text-slate-900">{p.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Majority {p.ageOfMajority}
                      {p.requireDualParentBelowAge != null ? ` · dual parent < ${p.requireDualParentBelowAge}` : ""}
                      {p.assentRequiredFromAge != null
                        ? ` · assent ${p.assentRequiredFromAge}–${p.assentRequiredToAge ?? "?"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </EConsentShell>
  )
}
