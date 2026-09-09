"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import EConsentShell from "@/components/econsent/EConsentShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import { useWorkspaceStudyLabel } from "@/hooks/useWorkspaceStudyLabel"
import eConsentService from "@/lib/services/eConsent.service"
import xemusAiService from "@/lib/services/xemusAi.service"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import visitScheduleService from "@/lib/services/visitSchedule.service"
import {
  EC_CARD,
  EC_EMPTY,
  EC_FIELD,
  EC_SECTION_HEAD,
} from "@/lib/econsent/econsentUi"
import {
  AUDIENCE_OPTIONS,
  CONSENT_TYPES,
  QUESTION_TYPES,
  defaultsForQuestionType,
  isDraftVersion,
  isIrbReviewVersion,
  canPublishVersion,
  makeStarterSections,
  newBlankQuestion,
  newSectionId,
  normalizeVisitScheduleOptions,
  sanitizeContentForApi,
  statusBadge,
} from "@/lib/econsent/consentTemplateDefaults"
import { toast } from "sonner"
import {
  ClipboardList,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import Link from "next/link"

function latestVersion(form) {
  const versions = [...(form?.versions || [])].sort((a, b) => (b.id || 0) - (a.id || 0))
  return versions[0] || null
}

export default function EConsentFormsPage() {
  const { studyId } = useStudyEConsentRequired()
  const { isAiConsentAssistEnabled } = useStudyAiSettingsForStudy(studyId)
  const studyLabel = useWorkspaceStudyLabel(studyId)
  const [view, setView] = useState("list") // list | create | edit
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [visits, setVisits] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Create / edit draft state
  const [name, setName] = useState("")
  const [consentType, setConsentType] = useState("Adult")
  const [visitScheduleId, setVisitScheduleId] = useState("")
  const [versionLabel, setVersionLabel] = useState("1.0")
  const [statusIntent, setStatusIntent] = useState("DRAFT") // DRAFT | APPROVED on save
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [expiryDays, setExpiryDays] = useState("")
  const [languageCode, setLanguageCode] = useState("en")
  const [sections, setSections] = useState([])
  const [questions, setQuestions] = useState([])
  const [editingFormId, setEditingFormId] = useState(null)
  const [editingVersionId, setEditingVersionId] = useState(null)
  const [readOnly, setReadOnly] = useState(false)
  const [compareResult, setCompareResult] = useState(null)
  const [irbVersionId, setIrbVersionId] = useState(null)
  const [irbForm, setIrbForm] = useState({
    irbProtocolNumber: "",
    irbApprovalReference: "",
    irbApprovalDate: "",
    notes: "",
  })
  const [irbBusy, setIrbBusy] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  const handleGenerateConsentQuestions = async () => {
    if (!studyId || !sections.length) {
      toast.error("Add at least one consent section with text first.")
      return
    }
    const sectionText = sections
      .map((s) => s.title || s.heading)
      .filter(Boolean)
      .join("\n\n")
    const htmlParts = sections.map((s) => s.htmlContent || s.content || "").join("\n")
    setGeneratingQuestions(true)
    try {
      const res = await xemusAiService.generateConsentQuestions({
        studyId,
        sectionText: htmlParts || sectionText,
        languageCode,
      })
      const generated = res?.data?.questions ?? res?.data ?? []
      if (!Array.isArray(generated) || !generated.length) {
        toast.message("No questions generated — try again or add manually.")
        return
      }
      setQuestions((prev) => [
        ...prev,
        ...generated.map((q) => ({
          ...newBlankQuestion(),
          ...q,
          id: q.id || newSectionId(),
          questionType: q.questionType || "MultipleChoice",
        })),
      ])
      toast.success(`Added ${generated.length} draft question(s) — review before publish.`)
    } catch (error) {
      toast.error(error?.message || "Question generation failed")
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const typeMeta = CONSENT_TYPES.find((t) => t.value === consentType) || CONSENT_TYPES[0]

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    setVisitsLoading(true)
    try {
      let formsRes = await eConsentService.getForms(studyId)
      // One retry — covers brief API restarts / cold start
      if (!formsRes?.isSuccess) {
        await new Promise((r) => setTimeout(r, 800))
        formsRes = await eConsentService.getForms(studyId)
      }
      if (formsRes?.isSuccess && Array.isArray(formsRes.data)) {
        setForms(formsRes.data)
      } else {
        setForms([])
        toast.error(formsRes?.message || "Failed to load consent forms. Check API is running.")
      }

      let visitRows = []
      const dropdownRes = await visitScheduleService.getVisitSchedulesForDropdown(studyId).catch(() => null)
      visitRows = normalizeVisitScheduleOptions(dropdownRes)
      if (visitRows.length === 0) {
        const byStudy = await visitScheduleService.getVisitSchedulesByStudyId(studyId).catch(() => null)
        visitRows = normalizeVisitScheduleOptions(byStudy)
      }
      if (visitRows.length === 0) {
        const listRes = await visitScheduleService
          .getVisitSchedulesList(1, 200, studyId, null, true)
          .catch(() => null)
        visitRows = normalizeVisitScheduleOptions(listRes)
      }
      setVisits(visitRows)
    } finally {
      setLoading(false)
      setVisitsLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void load()
  }, [load])

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return forms
    return forms.filter(
      (f) =>
        String(f.name || "").toLowerCase().includes(q) ||
        String(f.consentType || "").toLowerCase().includes(q),
    )
  }, [forms, search])

  const resetEditor = (withStarter = false) => {
    setName("")
    setConsentType("Adult")
    setVisitScheduleId("")
    setVersionLabel("1.0")
    setStatusIntent("DRAFT")
    setEffectiveFrom("")
    setExpiryDays("")
    setEditingFormId(null)
    setEditingVersionId(null)
    setReadOnly(false)
    if (withStarter) {
      const starter = makeStarterSections()
      setSections(starter.sections)
      setQuestions(starter.questions)
    } else {
      setSections([])
      setQuestions([])
    }
  }

  const openCreate = () => {
    resetEditor(false)
    setView("create")
  }

  const addStarter = () => {
    const starter = makeStarterSections()
    setSections((prev) => (prev.length ? prev : starter.sections))
    setQuestions((prev) => (prev.length ? prev : starter.questions))
    toast.success("Starter sections & questions added")
  }

  const openEdit = (form, version, { viewOnly = false } = {}) => {
    const v = version || latestVersion(form)
    if (!v) return
    setEditingFormId(form.id)
    setEditingVersionId(v.id)
    setName(form.name || "")
    setConsentType(form.consentType || "Adult")
    setVisitScheduleId(form.visitScheduleId != null ? String(form.visitScheduleId) : "")
    setVersionLabel(v.versionLabel || "1.0")
    const display = String(v.statusDisplay || v.status || "Draft")
    setStatusIntent(display.toLowerCase() === "approved" || display.toLowerCase() === "published" ? "APPROVED" : "DRAFT")
    setEffectiveFrom(v.effectiveFrom ? String(v.effectiveFrom).slice(0, 10) : "")
    setExpiryDays(v.expiryDays != null ? String(v.expiryDays) : "")
    setLanguageCode(v.languageCode || v.LanguageCode || "en")
    setSections(Array.isArray(v.sections) && v.sections.length ? v.sections : [])
    setQuestions(Array.isArray(v.questions) && v.questions.length ? v.questions : [])
    setReadOnly(viewOnly || !isDraftVersion(v))
    setView("edit")
  }

  const handleCreate = async () => {
    if (!studyId || !name.trim()) {
      toast.error("Form name is required")
      return
    }
    setBusy(true)
    try {
      const content = sanitizeContentForApi(sections, questions)
      const res = await eConsentService.createForm({
        studyId,
        name: name.trim(),
        consentType,
        visitScheduleId: visitScheduleId ? Number(visitScheduleId) : null,
        versionLabel: versionLabel.trim() || "1.0",
        addStarterContent: content.sections.length === 0 && content.questions.length === 0,
        sections: content.sections.length ? content.sections : undefined,
        questions: content.questions.length ? content.questions : undefined,
        effectiveFrom: effectiveFrom || null,
        expiryDays: expiryDays ? Number(expiryDays) : null,
        languageCode: languageCode || "en",
      })
      if (!res?.isSuccess) {
        toast.error(res?.message || "Failed to create form")
        return
      }
      const created = res.data
      const v = created?.versions?.[0]
      toast.success("Consent template created")
      await load()
      if (created && v) {
        if (statusIntent === "APPROVED") {
          const pub = await eConsentService.publishVersion(v.id)
          if (pub?.isSuccess) toast.success("Version approved")
          else toast.error(pub?.message || "Created as draft — approve failed")
          await load()
          setView("list")
          resetEditor()
        } else {
          openEdit(created, v)
        }
      } else setView("list")
    } catch {
      toast.error("Failed to create form")
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async ({ approve = false } = {}) => {
    if (!editingVersionId) return
    if (!name.trim()) {
      toast.error("Form name is required")
      return
    }
    setBusy(true)
    try {
      const content = sanitizeContentForApi(sections, questions)
      setSections(content.sections)
      setQuestions(content.questions)
      const res = await eConsentService.saveVersionContent(editingVersionId, {
        versionLabel: versionLabel.trim() || "1.0",
        sections: content.sections,
        questions: content.questions,
        effectiveFrom: effectiveFrom || null,
        expiryDays: expiryDays ? Number(expiryDays) : null,
        languageCode: languageCode || "en",
      })
      if (!res?.isSuccess) {
        const detail = Array.isArray(res?.errors) && res.errors.length
          ? res.errors.slice(0, 2).join("; ")
          : null
        toast.error(detail || res?.message || "Save failed")
        return
      }
      // If API forked a new draft (editing an approved version), track the new version id.
      if (res.data?.id && res.data.id !== editingVersionId) {
        setEditingVersionId(res.data.id)
      }
      const versionIdToPublish = res.data?.id || editingVersionId
      if (approve || statusIntent === "APPROVED") {
        const pub = await eConsentService.publishVersion(versionIdToPublish)
        if (!pub?.isSuccess) {
          toast.error(pub?.message || "Approve failed")
          return
        }
        toast.success("Consent template approved")
      } else {
        toast.success("Draft saved")
      }
      await load()
      setView("list")
      resetEditor()
    } catch {
      toast.error("Save failed")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete consent form “${form.name}”?`)) return
    setBusy(true)
    try {
      const res = await eConsentService.deleteForm(form.id)
      if (res?.isSuccess) {
        toast.success("Form deleted")
        await load()
      } else toast.error(res?.message || "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  const openIrbDialog = (version) => {
    if (!version?.id) return
    setIrbVersionId(version.id)
    setIrbForm({
      irbProtocolNumber: version.irbProtocolNumber || version.IrbProtocolNumber || "",
      irbApprovalReference: version.irbApprovalReference || version.IrbApprovalReference || "",
      irbApprovalDate: (version.irbApprovalDate || version.IrbApprovalDate || "").toString().slice(0, 10),
      notes: version.irbNotes || version.IrbNotes || "",
    })
  }

  const handleSubmitIrb = async (versionId) => {
    if (!versionId) return
    setBusy(true)
    try {
      const res = await eConsentService.submitVersionForIrb(versionId)
      if (res?.isSuccess) {
        toast.success("Submitted for IRB review")
        await load()
        if (editingVersionId === versionId) setView("list")
      } else toast.error(res?.message || "IRB submit failed")
    } finally {
      setBusy(false)
    }
  }

  const handleRecordIrb = async () => {
    if (!irbVersionId) return
    setIrbBusy(true)
    try {
      const res = await eConsentService.recordIrbApproval(irbVersionId, {
        irbProtocolNumber: irbForm.irbProtocolNumber || null,
        irbApprovalReference: irbForm.irbApprovalReference || null,
        irbApprovalDate: irbForm.irbApprovalDate || null,
        notes: irbForm.notes || null,
      })
      if (res?.isSuccess) {
        toast.success("IRB approval recorded")
        setIrbVersionId(null)
        await load()
      } else toast.error(res?.message || "Could not record IRB approval")
    } finally {
      setIrbBusy(false)
    }
  }

  const handlePublishVersion = async (versionId) => {
    if (!versionId) return
    setBusy(true)
    try {
      const res = await eConsentService.publishVersion(versionId)
      if (res?.isSuccess) {
        toast.success("Version approved / published")
        await load()
      } else toast.error(res?.message || "Publish failed — record IRB approval or enable publish without IRB in setup")
    } finally {
      setBusy(false)
    }
  }

  const updateSection = (id, patch) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const updateQuestion = (id, patch) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  if (view === "create" || view === "edit") {
    return (
      <>
      <EConsentShell
        title={view === "create" ? "Create consent template" : readOnly ? "View consent template" : "Edit consent template"}
        description={
          view === "create"
            ? "Add another consent form for a study (multiple forms per study are supported). Set site/visit usage in Consent rules."
            : "Update document version, text sections, and knowledge-check questions."
        }
      >
        <div className={`${EC_CARD} p-6 mb-6 space-y-5`}>
          <h2 className="text-sm font-semibold text-slate-900">
            {view === "create" ? "New consent template" : "Consent template"}
          </h2>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Study <span className="text-red-500">*</span>
            </label>
            <Input value={studyId ? studyLabel || `Study #${studyId}` : "Select study"} disabled />
            <p className="mt-1 text-xs text-slate-500">
              You can create multiple consent forms for the same study (e.g. main ICF and an optional addendum).
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Visit scope (optional)</label>
            <select
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={visitScheduleId}
              disabled={readOnly || visitsLoading}
              onChange={(e) => setVisitScheduleId(e.target.value)}
            >
              <option value="">Study-wide (all visits)</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {visitsLoading
                ? "Loading visits for this study…"
                : visits.length === 0
                  ? "No visit schedules found for this study yet. Create visits under Visit Schedule, or leave study-wide."
                  : "Optional: limit this form to one visit (e.g. screening-only ICF). Leave study-wide for the default form."}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Form name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main informed consent"
              disabled={readOnly || view === "edit"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                Consent type <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={consentType}
                disabled={readOnly || view === "edit"}
                onChange={(e) => setConsentType(e.target.value)}
              >
                {CONSENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Used with jurisdiction age bands to auto-select the right template at assignment.
              </p>
            </div>
            <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">{typeMeta.ageLabel}</p>
              <p className="mt-1 text-sm text-sky-900/90">{typeMeta.description}</p>
              <ol className="mt-2 list-decimal pl-4 text-sm text-sky-900 space-y-0.5">
                {typeMeta.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {!readOnly && view === "create" ? (
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addStarter}>
                  Add starter sections & questions
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`${EC_CARD} p-6 mb-6 space-y-4`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
                Document version <span className="text-red-500">*</span>
              </label>
              <Input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g. 1.0"
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Status</label>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={statusIntent}
                disabled={readOnly}
                onChange={(e) => setStatusIntent(e.target.value)}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="APPROVED">APPROVED</option>
              </select>
              <p className="mt-1 text-xs text-amber-700">
                Set status to APPROVED and save before assigning — draft forms are not used on the participant
                signing screen.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Which site or visit uses each form is set in{" "}
            <Link href="/econsent/rules" className="font-semibold underline">
              Consent rules
            </Link>{" "}
            — pick the matching form name on each study, site, or visit rule.
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Effective from (optional)</label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Expiry days (optional)</label>
              <Input
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="e.g. 365"
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Language</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                disabled={readOnly}
              >
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
                <option value="zh">Chinese (zh)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`${EC_CARD} p-6 mb-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Consent text sections</h2>
              <p className="text-xs text-slate-500">Written consent content shown to the participant.</p>
            </div>
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSections((prev) => [
                    ...prev,
                    {
                      id: newSectionId(),
                      title: `Section ${prev.length + 1}`,
                      audience: "All",
                      content: "",
                      sortOrder: prev.length,
                    },
                  ])
                }
              >
                <Plus className="w-4 h-4 mr-1" /> Add text section
              </Button>
            ) : null}
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">No sections yet. Add a text section or starter content.</p>
          ) : (
            <div className="space-y-4">
              {sections.map((section, idx) => (
                <div key={section.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">
                      Text section {idx + 1}{" "}
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Text
                      </span>
                    </p>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setSections((prev) => prev.filter((s) => s.id !== section.id))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Section title <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={section.title}
                      disabled={readOnly}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Audience (signer role)</label>
                    <select
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={section.audience || "All"}
                      disabled={readOnly}
                      onChange={(e) => updateSection(section.id, { audience: e.target.value })}
                    >
                      {AUDIENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      For child assent packages: set child sections to &apos;Child assent&apos; and parent sections to
                      &apos;Parent / guardian&apos;.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Section media</label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={section.mediaType || "None"}
                        disabled={readOnly}
                        onChange={(e) => updateSection(section.id, { mediaType: e.target.value })}
                      >
                        <option value="None">None</option>
                        <option value="Video">Video URL</option>
                        <option value="Embed">YouTube / Vimeo embed</option>
                      </select>
                    </div>
                    {(section.mediaType || "None") !== "None" ? (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Video URL</label>
                        <Input
                          value={section.videoUrl || ""}
                          disabled={readOnly}
                          placeholder="https://… or YouTube/Vimeo link"
                          onChange={(e) => updateSection(section.id, { videoUrl: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </div>
                  {(section.mediaType || "None") !== "None" ? (
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(section.requireVideoWatch)}
                        disabled={readOnly}
                        onChange={(e) => updateSection(section.id, { requireVideoWatch: e.target.checked })}
                      />
                      Require participant to watch before continuing
                    </label>
                  ) : null}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Content <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full min-h-[120px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Section content (HTML or plain text)"
                      value={section.content || ""}
                      disabled={readOnly}
                      onChange={(e) => updateSection(section.id, { content: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${EC_CARD} p-6 mb-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Knowledge check</h2>
              <p className="text-xs text-slate-500">Comprehension questions before signing.</p>
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                {isAiConsentAssistEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={generatingQuestions || !sections.length}
                    onClick={() => void handleGenerateConsentQuestions()}
                  >
                    {generatingQuestions ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1" />
                    )}
                    Generate questions
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestions((prev) => [...prev, newBlankQuestion()])}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add question
                </Button>
              </div>
            ) : null}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-slate-500">No questions yet.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const type = q.questionType || "MultipleChoice"
                const isFixedBinary = type === "TrueFalse" || type === "YesNo"
                const isAck = type === "Acknowledgment"
                const isMulti = type === "MultiSelect"
                const options = q.options || []

                return (
                  <div key={q.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        Question {idx + 1}{" "}
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {QUESTION_TYPES.find((t) => t.value === type)?.label || type}
                        </span>
                      </p>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Question type</label>
                        <select
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          value={type}
                          disabled={readOnly}
                          onChange={(e) => {
                            const nextType = e.target.value
                            updateQuestion(q.id, {
                              questionType: nextType,
                              ...defaultsForQuestionType(nextType),
                            })
                          }}
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">For signer role</label>
                        <select
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          value={q.signerRole || "Subject"}
                          disabled={readOnly}
                          onChange={(e) => updateQuestion(q.id, { signerRole: e.target.value })}
                        >
                          {AUDIENCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Question text</label>
                      <textarea
                        className="w-full min-h-[72px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={q.text || ""}
                        disabled={readOnly}
                        onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      />
                    </div>

                    {isAck ? (
                      <p className="text-xs text-slate-500">
                        Participant must check a confirmation box for this item. No answer key needed.
                      </p>
                    ) : (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {options.map((opt, optIdx) => (
                            <div key={optIdx}>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                                Option {String.fromCharCode(65 + optIdx)}
                              </label>
                              <Input
                                value={opt}
                                disabled={readOnly || isFixedBinary}
                                onChange={(e) => {
                                  const next = [...options]
                                  next[optIdx] = e.target.value
                                  updateQuestion(q.id, { options: next })
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {!readOnly && !isFixedBinary ? (
                          <div className="flex flex-wrap gap-3 text-xs">
                            <button
                              type="button"
                              className="text-sky-700 hover:underline"
                              onClick={() =>
                                updateQuestion(q.id, { options: [...options, ""] })
                              }
                            >
                              Add option
                            </button>
                            {options.length > 2 ? (
                              <button
                                type="button"
                                className="text-sky-700 hover:underline"
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    options: options.slice(0, -1),
                                    correctIndexes: (q.correctIndexes || []).filter(
                                      (i) => i < options.length - 1,
                                    ),
                                    correctIndex: Math.min(
                                      q.correctIndex ?? 0,
                                      options.length - 2,
                                    ),
                                  })
                                }
                              >
                                Remove last option
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {isMulti ? (
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">
                              Correct options (select all that apply) <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-3">
                              {options.map((_, optIdx) => {
                                const checked = (q.correctIndexes || []).includes(optIdx)
                                return (
                                  <label key={optIdx} className="flex items-center gap-1.5 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      disabled={readOnly}
                                      checked={checked}
                                      onChange={(e) => {
                                        const set = new Set(q.correctIndexes || [])
                                        if (e.target.checked) set.add(optIdx)
                                        else set.delete(optIdx)
                                        updateQuestion(q.id, {
                                          correctIndexes: [...set].sort((a, b) => a - b),
                                        })
                                      }}
                                    />
                                    {String.fromCharCode(65 + optIdx)}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">
                              Correct answer <span className="text-red-500">*</span>
                            </label>
                            <select
                              className="w-full max-w-xs rounded-md border border-slate-200 px-3 py-2 text-sm"
                              value={q.correctIndex ?? 0}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateQuestion(q.id, { correctIndex: Number(e.target.value) || 0 })
                              }
                            >
                              {options.map((opt, optIdx) => (
                                <option key={optIdx} value={optIdx}>
                                  {String.fromCharCode(65 + optIdx)}
                                  {opt ? ` — ${opt}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 mt-2 border-t border-slate-200/80 bg-white/95 px-1 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={busy}
              onClick={() => {
                setView("list")
                resetEditor()
              }}
            >
              Cancel
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {!studyId ? <p className="text-sm text-amber-700 mr-1">Select a study.</p> : null}
              {!readOnly && view === "create" ? (
                <Button
                  type="button"
                  variant="brand"
                  className="rounded-lg px-5"
                  onClick={handleCreate}
                  disabled={busy || !studyId}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save consent template
                </Button>
              ) : null}
              {!readOnly && view === "edit" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    onClick={() => handleSaveEdit({ approve: false })}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => handleSubmitIrb(editingVersionId)}
                    disabled={busy || !editingVersionId}
                  >
                    Submit for IRB
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() =>
                      openIrbDialog({
                        id: editingVersionId,
                        irbProtocolNumber: "",
                        irbApprovalReference: "",
                        irbApprovalDate: "",
                        irbNotes: "",
                      })
                    }
                    disabled={busy || !editingVersionId}
                  >
                    Record IRB
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    className="rounded-lg px-5"
                    onClick={() => handleSaveEdit({ approve: true })}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Save &amp; approve
                  </Button>
                </>
              ) : null}
              {readOnly ? (
                <Button
                  type="button"
                  variant="brand"
                  className="rounded-lg"
                  onClick={() => {
                    setView("list")
                    resetEditor()
                  }}
                >
                  Back to list
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </EConsentShell>
      {irbVersionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Record IRB approval</h3>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Protocol number"
                value={irbForm.irbProtocolNumber}
                onChange={(e) => setIrbForm((p) => ({ ...p, irbProtocolNumber: e.target.value }))}
              />
              <Input
                placeholder="Approval reference"
                value={irbForm.irbApprovalReference}
                onChange={(e) => setIrbForm((p) => ({ ...p, irbApprovalReference: e.target.value }))}
              />
              <Input
                type="date"
                value={irbForm.irbApprovalDate}
                onChange={(e) => setIrbForm((p) => ({ ...p, irbApprovalDate: e.target.value }))}
              />
              <Input
                placeholder="Notes"
                value={irbForm.notes}
                onChange={(e) => setIrbForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIrbVersionId(null)}>
                Cancel
              </Button>
              <Button type="button" variant="brand" disabled={irbBusy} onClick={handleRecordIrb}>
                {irbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save IRB approval
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </>
    )
  }

  return (
    <EConsentShell
      title="Consent forms"
      description="Create and version informed consent templates — main ICF, addenda, and visit-specific forms."
    >
      <div className="space-y-4">
        <div className={`${EC_CARD} flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {studyId ? studyLabel || `Study #${studyId}` : "No study"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {forms.length} form{forms.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className={`${EC_FIELD} w-[220px]`}
              placeholder="Search forms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={async () => {
                const left = window.prompt("Left version id to compare:")
                const right = window.prompt("Right version id to compare:")
                if (!left || !right) return
                const res = await eConsentService.compareVersions(Number(left), Number(right))
                if (res?.isSuccess && res.data) {
                  setCompareResult(res.data)
                  toast.success("Version compare loaded")
                } else toast.error(res?.message || "Compare failed")
              }}
            >
              Compare versions
            </Button>
            <Button
              type="button"
              variant="brand"
              className="rounded-lg"
              onClick={openCreate}
              disabled={!studyId}
            >
              <Plus className="h-4 w-4" /> Create consent form
            </Button>
          </div>
        </div>

        {compareResult ? (
          <div className={`${EC_CARD} p-4 sm:px-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Amendment compare</h3>
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setCompareResult(null)}>
                Close
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[compareResult.left || compareResult.Left, compareResult.right || compareResult.Right].map((v, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {idx === 0 ? "Left" : "Right"} · v{v?.versionLabel || v?.VersionLabel} · {v?.languageCode || v?.LanguageCode || "en"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Status {v?.statusDisplay || v?.StatusDisplay || v?.status} · sections{" "}
                    {(v?.sections || v?.Sections || []).length}
                  </p>
                  <div
                    className="prose prose-sm mt-2 max-h-64 overflow-auto text-slate-800"
                    dangerouslySetInnerHTML={{ __html: v?.contentHtml || v?.ContentHtml || "<p>No HTML</p>" }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={EC_CARD}>
          <div className={`${EC_SECTION_HEAD} flex items-center gap-3`}>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {studyId ? studyLabel || `Study #${studyId}` : "Select a study"}
              </p>
              <p className="text-xs text-slate-500">
                {filteredForms.length} consent form{filteredForms.length === 1 ? "" : "s"} · multiple forms per study
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading forms…
            </div>
          ) : filteredForms.length === 0 ? (
            <div className={EC_EMPTY}>
              <p className="font-medium text-slate-700">No consent forms yet</p>
              <p>
                Click <strong>Create consent form</strong> to add a main ICF for this study.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-[0.06em] text-slate-500">
                    <th className="px-4 py-3 font-semibold">Form name</th>
                    <th className="px-4 py-3 font-semibold">Version</th>
                    <th className="px-4 py-3 font-semibold">Scope</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Sections</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForms.map((form) => {
                    const v = latestVersion(form)
                    const badge = statusBadge(v?.statusDisplay, v?.status)
                    const sectionCount = Array.isArray(v?.sections) ? v.sections.length : 0
                    const draft = isDraftVersion(v)
                    const irb = isIrbReviewVersion(v)
                    const publishable = canPublishVersion(v)
                    return (
                      <tr key={form.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-semibold text-slate-900">{form.name}</td>
                        <td className="px-4 py-3 text-slate-600">v{v?.versionLabel || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {form.visitScheduleId
                            ? form.visitScopeLabel || `Visit #${form.visitScheduleId}`
                            : "Study-wide"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                          {v?.irbApprovedAt || v?.IrbApprovedAt ? (
                            <span className="ml-1 text-[10px] text-emerald-700">IRB ✓</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{sectionCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              title="View"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => openEdit(form, v, { viewOnly: true })}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"
                              onClick={() => openEdit(form, v)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {draft ? (
                              <button
                                type="button"
                                title="Submit for IRB"
                                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50"
                                disabled={busy || !v?.id}
                                onClick={() => handleSubmitIrb(v.id)}
                              >
                                IRB submit
                              </button>
                            ) : null}
                            {draft || irb ? (
                              <button
                                type="button"
                                title="Record IRB approval"
                                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                                disabled={busy || !v?.id}
                                onClick={() => openIrbDialog(v)}
                              >
                                IRB approve
                              </button>
                            ) : null}
                            {publishable ? (
                              <button
                                type="button"
                                title="Publish / approve version"
                                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                                disabled={busy || !v?.id}
                                onClick={() => handlePublishVersion(v.id)}
                              >
                                Publish
                              </button>
                            ) : null}
                            <button
                              type="button"
                              title="Delete"
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => handleDelete(form)}
                              disabled={busy}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {irbVersionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Record IRB approval</h3>
            <p className="mt-1 text-xs text-slate-500">
              Required before publish unless “Allow publish without IRB” is enabled in setup.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Protocol number</label>
                <Input
                  value={irbForm.irbProtocolNumber}
                  onChange={(e) => setIrbForm((p) => ({ ...p, irbProtocolNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Approval reference</label>
                <Input
                  value={irbForm.irbApprovalReference}
                  onChange={(e) => setIrbForm((p) => ({ ...p, irbApprovalReference: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Approval date</label>
                <Input
                  type="date"
                  value={irbForm.irbApprovalDate}
                  onChange={(e) => setIrbForm((p) => ({ ...p, irbApprovalDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Notes</label>
                <Input
                  value={irbForm.notes}
                  onChange={(e) => setIrbForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => setIrbVersionId(null)}>
                Cancel
              </Button>
              <Button type="button" variant="brand" className="rounded-lg" disabled={irbBusy} onClick={handleRecordIrb}>
                {irbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save IRB approval
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </EConsentShell>
  )
}
