# eCRF Rule Guideline Book

This document is the single reference for creating, applying, and validating rules in eCRF.

---

## 1) Purpose

Rules make eCRF behavior dynamic without hardcoding each study requirement.

Use rules to:
- show or hide fields
- enable or disable fields
- compute derived values
- block submit with a validation message
- raise retrospective warnings

---

## 2) Rule Categories (What and Why)

- `show`: Field is shown only when condition is true.
- `hide`: Field is hidden when condition is true.
- `enable`: Field becomes editable when condition is true.
- `disable`: Field becomes read-only when condition is true.
- `compute`: Field value is auto-calculated from expression.
- `submit`: On submit, if condition is true, show error and block submission.
- `retro`: Post-entry warning based on condition.

---

## 3) When to Use Rules

Use rules when behavior depends on user input.

Good cases:
- "If Other selected, show Specify field"
- "If Eligibility = No, freeze remaining controls"
- "BMI = Weight/Height formula"
- "Under 18 requires guardian consent"

Do not use rules for:
- static labels/text formatting
- one-time UI styling
- behavior that should always be fixed regardless of data

---

## 4) Expression Basics (How)

Rules use field labels in authoring view.

Supported operators:
- `==`, `!=`, `>`, `>=`, `<`, `<=`
- `&&`, `||`
- `+`, `-`, `*`, `/`

Examples:
- `Age >= 18`
- `Gender == "Male"`
- `Status == "Active" && VisitCount > 1`
- `Body Part Where Applied.indexOf("Other") >= 0`
- `Weight * 10000 / (Height * Height)`

Important:
- String values must be in quotes.
- Label names should match exactly.
- Keep labels clean and unique to avoid ambiguity.

---

## 4A) Deep Operator Guide (Expert Level)

Use this as quick grammar reference while authoring conditions.

- **Equality**
  - `==` equal, `!=` not equal
  - Example: `VisitType == "Screening"`
- **Comparison**
  - `>`, `>=`, `<`, `<=`
  - Example: `Hemoglobin < 10`
- **Logical**
  - `&&` AND (both true), `||` OR (any true)
  - Example: `Gender == "Female" && Age >= 18`
- **Arithmetic**
  - `+`, `-`, `*`, `/`
  - Example: `(Weight * 10000) / (Height * Height)`
- **Grouping**
  - Always use parentheses for complex rules.
  - Example: `(Age < 18 && Consent != "Guardian") || (Age >= 18 && Consent == "")`

### Operator precedence (safe practice)

Engine precedence can confuse users in long expressions. Follow this rule:
1. Put math inside parentheses.
2. Put each logical block in parentheses.
3. Join blocks with `&&` / `||`.

Recommended style:
`(Block1) && (Block2) && (Block3)`

---

## 4B) Common Expression Patterns (Many Ways)

- **Exact match**
  - `Country == "India"`
- **Any of two values**
  - `Country == "India" || Country == "USA"`
- **Range**
  - `Age >= 18 && Age <= 65`
- **Not blank check**
  - `Weight != ""`
- **Checkbox contains item**
  - `Symptoms.indexOf("Fever") >= 0`
- **Text has keyword**
  - `Remarks.indexOf("urgent") >= 0`
- **Cross-field compare**
  - `VisitDate >= ScreeningDate`
- **Derived formula**
  - `(Systolic + (2 * Diastolic)) / 3`

---

## 5) Step-by-Step: Create and Apply Rule

### A. Create rule
1. Open `Study Management -> Rule Designer`.
2. Click `Create Rule`.
3. Fill:
   - Rule name
   - Category
   - Expression
   - Message (for `submit`/`retro`)
4. Save.

### B. Apply rule to control
1. Open `Study Management -> eCRF Form Designer -> Manage eCRF Form`.
2. Edit the CRF.
3. Select target control.
4. In right properties panel, open `Rules`.
5. Choose rule(s) to attach.
6. Save CRF.

### C. Verify
1. Preview the CRF.
2. Enter trigger values.
3. Confirm show/hide/enable/disable/compute/submit behavior.

---

## 5A) Deep Rule Authoring Workflow (From Requirement to Go-Live)

Use this sequence for each new requirement:

1. **Write requirement in one line**
   - Example: "Show pregnancy test field only for female subjects of child-bearing age."
2. **Identify trigger fields**
   - `Gender`, `Age`, maybe `MenopauseStatus`.
3. **Choose target control**
   - The control that should react (show/hide/enable/etc.).
4. **Choose category**
   - visibility -> `show/hide`, editability -> `enable/disable`, formula -> `compute`, gate -> `submit`.
5. **Draft expression**
   - Start simple, then add edge blocks.
6. **Add message (if submit/retro)**
   - Human-readable and action-oriented.
7. **Attach rule to target control**
8. **Run positive/negative/boundary tests**
9. **Save, reopen, and retest**
10. **Capture QA evidence**
   - screenshots + scenario sheet.

---

## 5B) How to Add Multiple Rules on Same Field (Safely)

You can attach multiple rules to one control. Use this strategy:

- Keep each rule focused on one responsibility.
- Avoid contradictory pairs on same condition (for example both `show` and `hide` with same trigger).
- Prefer readable blocks:
  - `SHOW_...`
  - `ENABLE_...`
  - `SUBMIT_...`
- Test interaction order with 3 datasets:
  - all false
  - one true
  - multiple true

Example stack on one target field:
1. `SHOW_IfOtherSelected`
2. `ENABLE_WhenEditableMode`
3. `SUBMIT_IfShownButEmpty`

---

## 6) Edit / Remove Rule

- To edit logic: update rule in Rule Designer, then re-test impacted CRFs.
- To remove from one control: open control properties and remove that rule assignment.
- To retire completely: remove assignment from all controls before deleting rule definition.

---

## 7) Recommended Naming Standard

Use clear names with action + condition:
- `SHOW_IfOtherSelected`
- `DISABLE_WhenEligibilityNo`
- `COMPUTE_BMI`
- `SUBMIT_GuardianConsentUnder18`

This helps BA/QA quickly understand intent.

---

## 8) QA Checklist (Mandatory)

For every new/changed rule:
1. Positive case (condition true) verified.
2. Negative case (condition false) verified.
3. Boundary values checked (`<`, `<=`, `>`, `>=`).
4. Submit behavior checked if category is `submit`.
5. Rule interaction checked when multiple rules exist on same control.
6. Save/reopen CRF and confirm behavior persists.

---

## 9) Common Problems and Fixes

- Rule not firing:
  - Verify exact label in expression.
  - Verify rule is assigned to correct target control.
  - Verify category is correct for expected behavior.

- Wrong field affected:
  - Confirm selected control before assigning rule.
  - Check for duplicate or confusing field labels.

- Submit not blocked:
  - Ensure category is `submit` and message is configured.

- Computed value blank:
  - Check source fields are numeric and available before evaluation.

---

## 10) Governance Notes

- Do not add rules "just in case"; add only requirement-backed rules.
- Keep logic simple and auditable.
- Any rule that changes eligibility, status, or submission outcome must include BA sign-off and QA test evidence.

---

## 11) Quick Templates

- Show specify field:
  - Category: `show`
  - Expression: `Main Field.indexOf("Other") >= 0`

- Freeze form if not eligible:
  - Category: `disable`
  - Expression: `Eligibility == "No"`

- BMI compute:
  - Category: `compute`
  - Expression: `Weight * 10000 / (Height * Height)`

- Underage consent validation:
  - Category: `submit`
  - Expression: `Age < 18 && Consent != "Guardian"`
  - Message: `Guardian consent is required for subjects under 18.`

- Multi-condition visibility:
  - Category: `show`
  - Expression: `(Gender == "Female") && (Age >= 18 && Age <= 49)`

- Cross-field chronology check:
  - Category: `submit`
  - Expression: `VisitDate < ScreeningDate`
  - Message: `Visit Date cannot be earlier than Screening Date.`

---

If needed, keep this file as the baseline and append study-specific rule catalogs in separate files (for example: `STUDY_ABC_RULE_MATRIX.md`).
