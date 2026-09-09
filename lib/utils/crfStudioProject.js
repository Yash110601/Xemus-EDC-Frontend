/** Normalize API project row (camelCase or PascalCase) for CRF Studio UI. */
export function normalizeCrfStudioProject(project) {
  if (!project || typeof project !== "object") return project

  return {
    ...project,
    id: project.id ?? project.Id,
    name: project.name ?? project.Name,
    status: project.status ?? project.Status,
    protocolFileName: project.protocolFileName ?? project.ProtocolFileName ?? null,
    protocolChecksumSha256:
      project.protocolChecksumSha256 ?? project.ProtocolChecksumSha256 ?? null,
    crfPdfFileName: project.crfPdfFileName ?? project.CrfPdfFileName ?? null,
    crfPdfChecksumSha256:
      project.crfPdfChecksumSha256 ?? project.CrfPdfChecksumSha256 ?? null,
    extractionPassesJson:
      project.extractionPassesJson ?? project.ExtractionPassesJson ?? "[]",
    draftTreeJson: project.draftTreeJson ?? project.DraftTreeJson ?? "{}",
    coverageReportJson:
      project.coverageReportJson ?? project.CoverageReportJson ?? "{}",
  }
}

export function getProtocolChecksum(project) {
  const row = normalizeCrfStudioProject(project)
  const value = row?.protocolChecksumSha256
  return value != null && String(value).trim() !== "" ? String(value).trim() : ""
}

export function getCrfReferenceChecksum(project) {
  const row = normalizeCrfStudioProject(project)
  const value = row?.crfPdfChecksumSha256
  return value != null && String(value).trim() !== "" ? String(value).trim() : ""
}

export function canRunCrfStudioExtraction(project) {
  return Boolean(getProtocolChecksum(project) || getCrfReferenceChecksum(project))
}

export function mergeCrfStudioProjectList(projects, updated) {
  const normalized = normalizeCrfStudioProject(updated)
  if (!normalized?.id) return projects
  const hasRow = projects.some((p) => String(p.id) === String(normalized.id))
  if (!hasRow) return [...projects, normalized]
  return projects.map((p) =>
    String(p.id) === String(normalized.id) ? { ...p, ...normalized } : p,
  )
}
