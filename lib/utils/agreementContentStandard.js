/**
 * Xemus standard agreement body typography.
 * Matches StudyAgreementLetter.html `.content` + agreement editor `variant="agreement"`.
 */
export const AGREEMENT_TEXT_STANDARD = Object.freeze({
  fontFamily: "Georgia, 'Times New Roman', Times, serif",
  fontSize: "15px",
  lineHeight: "1.55",
  sectionLineHeight: "1.65",
  paragraphMargin: "8px 0",
  sectionTitleMargin: "14px 0 6px",
  textAlign: "justify",
  bodyColor: "#1d1d1f",
  headingColor: "#1e293b",
  tableClass: "agreement-rich-table",
})

function paragraph(html, extraStyle = "") {
  return `<p style="margin:${AGREEMENT_TEXT_STANDARD.paragraphMargin};line-height:${AGREEMENT_TEXT_STANDARD.lineHeight};text-align:${AGREEMENT_TEXT_STANDARD.textAlign};color:${AGREEMENT_TEXT_STANDARD.bodyColor};font-size:${AGREEMENT_TEXT_STANDARD.fontSize};${extraStyle}">${html}</p>`
}

function sectionTitle(number, title) {
  return `<p style="margin:${AGREEMENT_TEXT_STANDARD.sectionTitleMargin};line-height:${AGREEMENT_TEXT_STANDARD.lineHeight};"><strong style="color:${AGREEMENT_TEXT_STANDARD.headingColor};font-weight:600;">${number}. ${title}</strong></p>`
}

function milestoneTableHtml() {
  return `<table class="${AGREEMENT_TEXT_STANDARD.tableClass}" style="border-collapse:collapse;width:100%;margin:12px 0;">
<thead>
<tr>
<th style="padding:12px 14px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;background:#f8fafc;color:#334155;">Milestone</th>
<th style="padding:12px 14px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;background:#f8fafc;color:#334155;">Amount (INR)</th>
<th style="padding:12px 14px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;background:#f8fafc;color:#334155;">Payment Criteria</th>
</tr>
</thead>
<tbody>
<tr>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;">Milestone 1</td>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;">—</td>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;">On completion of agreed patient data entry</td>
</tr>
<tr>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;background:#f8fafc;">Milestone 2</td>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;background:#f8fafc;">—</td>
<td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;background:#f8fafc;">On study completion / final submission</td>
</tr>
</tbody>
</table>`
}

/**
 * Standard agreement body HTML for Header Content (create / new study).
 * Doctor card, study details, subject line, payment grid, signatures are added by backend template.
 */
export function buildStandardAgreementBodyHtml({ companyName = "the Company" } = {}) {
  const company = (companyName || "the Company").trim()

  return [
    paragraph("Dear Dr,", "margin-top:0;"),
    paragraph(
      `This has reference to our discussion regarding engagement of your services for a clinical research study. <strong style="color:${AGREEMENT_TEXT_STANDARD.headingColor};font-weight:600;">${company}</strong> (hereinafter referred to as &ldquo;Company&rdquo;) is engaged in providing technology-enabled clinical research solutions.`
    ),
    paragraph(
      "We intend to engage you for your views and suggestions on the specific terms set out below for participation in the study."
    ),
    sectionTitle("1", "Scope of Consultancy / Services"),
    `<ol style="margin:8px 0 12px 24px;padding:0;line-height:${AGREEMENT_TEXT_STANDARD.lineHeight};color:${AGREEMENT_TEXT_STANDARD.bodyColor};font-size:${AGREEMENT_TEXT_STANDARD.fontSize};">
<li style="margin:6px 0;">Participation in the clinical study as Principal Investigator / Co-Investigator, including patient screening, enrolment, and follow-up as per the approved protocol.</li>
<li style="margin:6px 0;">Accurate and timely data entry through the electronic Case Report Form (eCRF) or physical case report form, as applicable to the study.</li>
<li style="margin:6px 0;">Compliance with ICH-GCP, applicable regulatory requirements, and site SOPs throughout the study period.</li>
</ol>`,
    sectionTitle("2", "Honorarium &amp; Payment Milestones"),
    paragraph(
      "In consideration of the services rendered, the Company shall pay you honorarium as per the milestone schedule below. Payment shall be processed upon achievement of the respective milestone and verification of data quality."
    ),
    milestoneTableHtml(),
    sectionTitle("3", "Confidentiality"),
    paragraph(
      "You shall maintain strict confidentiality of all study-related information, patient data, and proprietary materials of the Company and Sponsor, both during and after the study."
    ),
    sectionTitle("4", "Term &amp; Termination"),
    paragraph(
      "This engagement shall remain in effect for the duration of the study unless terminated earlier by either party with reasonable written notice, subject to completion of ongoing patient obligations."
    ),
    paragraph(
      "We request you to review the above terms. Upon acceptance, please proceed with digital signature through the Xemus EDC platform.",
      "margin-bottom:0;"
    ),
  ].join("")
}

export function isAgreementContentEmpty(html) {
  if (!html || typeof html !== "string") return true
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.length === 0
}
