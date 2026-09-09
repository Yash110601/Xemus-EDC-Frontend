# How to Use Rules on CRF Design Dynamically

## Overview

Rules allow you to dynamically control CRF form behavior based on field values. Rules can show/hide fields, enable/disable controls, compute values, and trigger validation messages. **Rules are not default**—you create and assign rules only as per your study/form requirements; each control behaves by the rules you set.

---

## Example Rules (Ready to Create)

Use these as templates. Create only the rules your study requires. Replace field labels (e.g. Age, Gender, Weight) with your actual control labels.

| Rule Name | Category | Rule Expression | Use When |
|-----------|----------|------------------|----------|
| **Freeze CRF when not eligible** | **disable** | **`Eligibility == "No"`** | Set the Yes/No control label to **Eligibility**. Attach this rule to every other control; when user selects "No", those fields become read-only (CRF freezes). |
| **Show when Other selected (Body Part)** | **show** | **`Body Part Where Applied.indexOf("Other") >= 0`** | Attach to **"If Other, Please Specify"**. Set the checkbox control label to **Body Part Where Applied**. When user selects "Other", the specify field opens. |
| **Show when Any Other Specify selected (Adverse Event)** | **show** | **`Adverse Event Observed.indexOf("Any Other Specify") >= 0`** | Attach to the specify field. Set the main control label to **Adverse Event Observed**. When user selects "Any Other Specify", the specify field opens. |
| Hide if under 18 | hide | `Age < 18` | Attach to a control that must be hidden when Age is under 18. |
| Enable when Active | enable | `Status == "Active"` | Attach to a control that should be disabled until Status is Active. |
| Adult consent required | submit | `Age < 18 && Consent == "Yes"` | Message: "Guardian consent required for under 18." Validates on submit. |
| BMI Compute | compute | `Weight * 10000 / (Height * Height)` | Attach to a number field to auto-fill BMI (use your Weight/Height labels). |

---

## Step-by-Step: How to Create a Rule

### 1. Open Rule Designer

1. Go to **Study Management** → **Rule Designer**.
2. Click **Create Rule** (or **Add Rule**).

### 2. Fill in Rule Details

1. **Rule Name**  
   Enter a clear name (e.g. `Show when Other selected`, `Hide if under 18`). This helps you find the rule when assigning it to controls.

2. **Rule Category**  
   Choose one:
   - **show** – Control is hidden until condition is true; then it is shown.
   - **hide** – Control is visible until condition is true; then it is hidden.
   - **enable** – Control is disabled until condition is true; then it is enabled.
   - **disable** – Control is enabled until condition is true; then it is disabled.
   - **compute** – Value is calculated from the expression and written to the control.
   - **submit** – Validation on submit; if condition is true, show error and block submit.
   - **retro** – Validation after save; if condition is true, show warning.

3. **Rule Expression**  
   - Use **Available Fields** on the side: click a field to insert its label into the expression.
   - Use operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `&&`, `||`.
   - For text, use quotes: `Status == "Active"`, `Gender == "Male"`.
   - For checkbox “Other”: `Your Checkbox Label.indexOf("Other") >= 0`.
   - Examples: `Age > 18`, `Weight * 10000 / (Height * Height)`.

4. **Message** (only for **submit** and **retro**)  
   Enter the error or warning message shown when the condition is true.

5. Click **Save** (or **Create**).

### 3. Assign the Rule to a Control

1. Go to **Study Management** → **CRF Designer**.
2. Open your CRF and select the **control** that should be affected (e.g. the "If Other, Please Specify" text field).
3. In the **Properties Panel** (right), scroll to **Rules**.
4. In the rules dropdown, select the rule you created (e.g. "Show when Other selected").
5. The rule is now attached to that control. You can assign multiple rules to one control.
6. Remove a rule using the trash icon next to it.

### 4. How Rules Work Dynamically

Rules are evaluated in real-time when form values change:

#### Rule Expression Syntax

Rules use field labels in expressions:
- Field references: Use the control's label text
- Operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `&&`, `||`, `+`, `-`, `*`, `/`
- Functions: `DATE_DIFF()`, `DATE_ADD()`, `TIME_DIFF()`, `SUBSTRING()`, `CONCAT()`
- Keywords: `Today`, `'Year'`, `'Month'`, `'Day'`, etc.

#### Example Rule Expressions

```
# Show field when another field equals a value
Age > 18

# Hide field based on multiple conditions
Gender == 'Male' && Age < 65

# Enable field when condition is met
Status == 'Active'

# Compute value
Weight * Height / 10000

# Show "If Other, Please Specify" when "Other" is checked in a checkbox group
# (Click the checkbox field in Available Fields, then type the rest)
Body Part Where Applied.indexOf("Other") >= 0
```

### 5. Example: Show "If Other, Please Specify" when "Other" is selected (Body Part Where Applied)

**Rules are not default**—you add rules only when your form requirement says so. When the requirement is *"show the ‘If Other, Please Specify’ field only when the user selects ‘Other’ in a checkbox group"*, configure it like this:

1. Select the **"If Other, Please Specify"** control (the text field to show/hide).
2. Open **Create Rule** / **Edit Rule**.
3. **Rule name:** e.g. "Show when Other selected" (as per your requirement).
4. **Rule category:** **Show Action** (field hidden until condition is true).
5. **Rule expression:**  
   - Use the **exact label** of your checkbox field (e.g. "Body Part Where Applied"). Click it in Available Fields or type it.  
   - Then add: **.indexOf("Other") >= 0**  
   - Full expression: `Body Part Where Applied.indexOf("Other") >= 0` (replace the label if yours is different).
6. Save the rule.

Result: "If Other, Please Specify" is hidden until the user checks "Other"; then it appears. Omit this rule if your requirement does not need this behavior.

### 5b. Example: Eligibility criteria – freeze CRF when "No" (user cannot enter data)

**Requirement:** Eligibility Yes/No – when the user selects **No**, the rest of the CRF should **freeze** (all other fields become read-only; user cannot enter data).

**Steps:**

1. **Add the eligibility question control**
   - In CRF Designer, add a control (Dropdown or Radio).
   - Set its **label to exactly: Eligibility** (so the rule expression works without partial-match errors).
   - Set options: **Yes** and **No** (exact text, case-sensitive in expression).
   - Place it at the top of the form so the user answers it first.

2. **Use the built-in rule (or create one)**
   - The built-in rule **"Freeze CRF when not eligible"** uses the expression: **`Eligibility == "No"`**.
   - So the control’s label **must be "Eligibility"** for the rule to work. (You can still show a longer question in help text or description if needed.)

3. **Assign the rule to every other control**
   - For **each control that should freeze** when eligibility is No (all fields except the eligibility control), select that control → **Rules** → choose **"Freeze CRF when not eligible"**.
   - Do **not** attach this rule to the eligibility control (so the user can still change Yes/No).

**Result:** When the user selects **No** for Eligibility, every field that has this rule becomes read-only (CRF is frozen). When they select **Yes**, those fields are editable again.

**Why "Eligibility" and not a long label?** Using a single-word label like **Eligibility** avoids expression errors where one word (e.g. "Is") is replaced by another field’s value and breaks the rule. Keep the rule expression as `Eligibility == "No"` and set the control label to **Eligibility**.

### 6. Rule Categories Explained

#### Show/Hide Rules
- **Show**: Control is hidden by default, shown when condition is true
- **Hide**: Control is visible by default, hidden when condition is true

#### Enable/Disable Rules
- **Enable**: Control is disabled by default, enabled when condition is true
- **Disable**: Control is enabled by default, disabled when condition is true

#### Compute Rules
- Calculates a value based on expression
- Updates the control's value automatically

#### Submit/Retro Rules
- **Submit**: Validates on form submission, shows error message if condition fails
- **Retro**: Validates retrospectively, shows warning message

### 7. Testing Rules

1. In **CRF Designer**, click **Preview** button
2. Fill in form fields
3. Watch rules apply dynamically:
   - Fields show/hide based on values
   - Fields enable/disable automatically
   - Computed values update in real-time

### 8. Rule Evaluation Flow

```
User changes field value
    ↓
Form values updated
    ↓
All rules re-evaluated
    ↓
Rule conditions checked
    ↓
Actions applied to controls:
  - Show/Hide
  - Enable/Disable
  - Compute values
    ↓
UI updates automatically
```

## Field identification: Control ID vs label

**Yes — for each field, form values are keyed by control ID.**

| Where | What is used | Example |
|-------|----------------|--------|
| **Form data (values)** | **Control ID** | `formValues["ctrl_1770181461443_abc123"] = "Male"` — every field’s value is stored under its `control.id`. |
| **Rule Designer (expression you type)** | **Field label** | You write `Gender == "Male"` or `Body Part Where Applied.indexOf("Other") >= 0` — readable labels, not IDs. |
| **Saved rule (sent to API)** | **Control ID** | Before save, labels in the expression are replaced with control IDs so the API receives e.g. `ctrl_1770181461443_abc123 == "Male"`. |
| **Evaluation at runtime** | **Both** | Form values are looked up by control ID (and by label when the expression still uses labels). Rules work whether the expression has IDs or labels. |

So: you **design** rules using **field labels**; **internally and in the API**, each field is identified by its **control ID**, and form values are always passed/keyed by that control ID.

---

## Technical Implementation

### Rule Storage

Rules are stored in:
- **Control Properties**: `control.properties.rules = [rule1, rule2, ...]`
- Each rule contains: `id`, `ruleName`, `ruleCategory`, `ruleExpression`, `message`

### Rule Evaluation

The `useRuleEvaluation` hook:
1. Tracks all form values
2. Evaluates rule expressions when values change
3. Applies rule actions to controls
4. Returns updated controls with rules applied

### Example: Assigning a Rule Programmatically

```javascript
// In PropertiesPanel, when user selects a rule:
const handleRuleAssignment = (ruleId) => {
  const rule = availableRules.find(r => r.id === ruleId)
  const currentRules = control.properties.rules || []
  
  handlePropertyChange("rules", [...currentRules, {
    id: rule.id,
    ruleName: rule.ruleName,
    ruleCategory: rule.ruleCategory,
    ruleExpression: rule.ruleExpression,
    message: rule.message
  }])
}
```

## Best Practices

1. **Use Clear Field Labels**: Rule expressions use field labels, so use descriptive names
2. **Test Rules Thoroughly**: Always test rules in preview mode before saving
3. **Keep Expressions Simple**: Complex expressions can be hard to debug
4. **Document Rules**: Use descriptive rule names that explain the purpose
5. **Order Matters**: Multiple rules on one control are evaluated in order

## Troubleshooting

**Rule not applying?**
- Check rule expression syntax
- Verify field labels match exactly
- Ensure rule category is appropriate for the action

**Control not showing/hiding?**
- Check if `show` or `hide` rule is assigned
- Verify rule condition is correct
- Test in preview mode

**Computed value not updating?**
- Ensure `compute` rule category is used
- Check expression syntax
- Verify referenced fields exist
