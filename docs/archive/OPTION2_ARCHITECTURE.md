# Option 2 Architecture: Front-End CRF Design + Back-End Rules

This document describes the implementation of **Option 2** architecture where CRFs are designed in the front-end with simple rule support, while complex rules are implemented in the back-end rule engine.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONT-END (React)                         │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────┐        │
│  │ CRF Designer     │      │ Simple Rules (UI)     │        │
│  │                  │      │                      │        │
│  │ • Form Layout    │      │ • Min/Max Values     │        │
│  │ • Field Types    │      │ • Required-If        │        │
│  │ • Basic Props    │      │ • Field Dependencies │        │
│  └────────┬─────────┘      └──────────┬───────────┘        │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │ API Save/Submit │                            │
│              └────────┬────────┘                            │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACK-END (.NET 8)                          │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────────┐        │
│  │ CRF Storage      │      │ Rule Engine           │        │
│  │                  │      │                      │        │
│  │ • Save CRF       │      │ • Complex Rules      │        │
│  │ • Load CRF       │      │ • Cross-Visit Logic  │        │
│  │ • Versioning     │      │ • Protocol Logic     │        │
│  └────────┬─────────┘      └──────────┬───────────┘        │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │ Discrepancy     │                            │
│              │ Notes Generator │                            │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## Rule Classification

### Front-End Simple Rules (UI-Configurable)

These rules are created and configured directly in the CRF Designer UI:

1. **Numeric Range Validation**
   - Min/Max values for number fields
   - Example: Age must be between 18-65
   - Stored in: `control.properties.min` and `control.properties.max`

2. **Required Field**
   - Basic required field validation
   - Stored in: `control.properties.required`

3. **Required-If (Simple Conditional)**
   - Field becomes required based on another field's value
   - Example: "AE Description" required if "AE = Yes"
   - Stored in: `control.properties.requiredIf` (expression)

4. **Field Visibility (Show/Hide)**
   - Show/hide fields based on simple conditions
   - Example: Show "Pregnancy Test" only if "Gender = Female"
   - Stored in: `control.properties.rules[]` with category "show"/"hide"

5. **Field Enable/Disable**
   - Enable/disable fields based on simple conditions
   - Stored in: `control.properties.rules[]` with category "enable"/"disable"

### Back-End Complex Rules (Code-Based)

These rules are implemented in the back-end rule engine by developers:

1. **Cross-Visit Validation**
   - Compare values across different visits/events
   - Example: Dose cannot decrease across cycles unless toxicity occurred

2. **Time-Window Checks**
   - DATE_DIFF and TIME_DIFF calculations
   - Example: Visit 2 must be within 7 days of Visit 1

3. **Protocol Logic**
   - Complex business rules combining multiple data points
   - Example: Inclusion/exclusion criteria, dosing calculations

4. **Safety Rules**
   - AE/SAE handling, lab value alerts
   - Example: Automatic SAE notification if certain conditions met

5. **Derived Calculations**
   - Complex formulas and computations
   - Example: BMI calculation, dose adjustments

## Implementation Details

### Front-End Simple Rules

#### 1. Numeric Range (Min/Max)

**Location**: Properties Panel → Number Field Properties

```javascript
// In PropertiesPanel.jsx for number fields
<Input
  type="number"
  value={props.min || ""}
  onChange={(e) => handlePropertyChange("min", e.target.value ? Number(e.target.value) : null)}
  placeholder="Min value"
/>
<Input
  type="number"
  value={props.max || ""}
  onChange={(e) => handlePropertyChange("max", e.target.value ? Number(e.target.value) : null)}
  placeholder="Max value"
/>
```

**Storage**: 
```json
{
  "properties": {
    "min": 18,
    "max": 65
  }
}
```

**Validation**: Runs client-side during data entry

#### 2. Required-If

**Location**: Properties Panel → Rules Section → "Add Required-If Rule"

```javascript
// Simple required-if rule
{
  "id": "rule_req_if_001",
  "ruleName": "AE Description Required If AE = Yes",
  "ruleCategory": "validation",
  "ruleExpression": "AE == 'Yes'",
  "message": "AE Description is required when AE is Yes",
  "severity": "HARD"
}
```

**Storage**: In `control.properties.rules[]`

**Validation**: Runs client-side during data entry

#### 3. Field Visibility Rules

**Location**: Rules Panel or Rule Creation Modal

```javascript
// Show field based on condition
{
  "id": "rule_show_001",
  "name": "Show Pregnancy Test for Females",
  "category": "show",
  "expression": "Gender == 'Female'",
  "targetField": "PregnancyTest"
}
```

### Back-End Complex Rules

#### Rule Definition (Back-End)

Rules are defined in the back-end using:

1. **Rule Engine Configuration** (JSON/XML)
2. **Code-Based Rules** (C#/Java)
3. **DSL (Domain-Specific Language)**

**Example Back-End Rule**:

```csharp
// C# .NET 8 Rule Engine
public class CrossVisitDoseRule : IRule
{
    public string RuleId => "CROSS_VISIT_DOSE_001";
    
    public List<Discrepancy> Evaluate(CrfContext context)
    {
        var discrepancies = new List<Discrepancy>();
        
        // Get current visit dose
        var currentDose = context.GetValue("CurrentVisit", "Dose");
        var previousDose = context.GetValue("PreviousVisit", "Dose");
        
        // Get toxicity flag
        var hasToxicity = context.GetValue("CurrentVisit", "HasToxicity");
        
        // Rule: Dose cannot decrease unless toxicity occurred
        if (currentDose < previousDose && !hasToxicity)
        {
            discrepancies.Add(new Discrepancy
            {
                RuleId = RuleId,
                Message = "Dose cannot decrease from previous visit unless toxicity occurred",
                Severity = "BLOCKING"
            });
        }
        
        return discrepancies;
    }
}
```

#### Rule Execution Flow

```
Data Entry (Front-End)
    ↓
Simple Rules Validation (Client-Side)
    ↓
Save/Submit API Call
    ↓
Back-End Rule Engine Execution
    ↓
Discrepancy Notes Generated
    ↓
Response to Front-End
```

## API Payload Structure

### Save CRF Payload

```json
{
  "id": "crf_123",
  "config": { ... },
  "sections": [
    {
      "id": "section_1",
      "controls": [
        {
          "id": "ctrl_age",
          "type": "number",
          "properties": {
            "min": 18,           // ← Simple rule (front-end)
            "max": 65,           // ← Simple rule (front-end)
            "required": true,    // ← Simple rule (front-end)
            "rules": [           // ← Simple rules (front-end)
              {
                "id": "rule_001",
                "ruleName": "Show if Gender = Female",
                "ruleCategory": "show",
                "ruleExpression": "Gender == 'Female'",
                "severity": "SOFT"
              }
            ]
          }
        }
      ]
    }
  ],
  "rules": [],  // CRF-level simple rules (front-end)
  "complexRules": []  // References to back-end rules (rule IDs only)
}
```

### Back-End Rule References

For complex rules, the front-end only stores rule IDs that reference back-end rules:

```json
{
  "complexRules": [
    {
      "ruleId": "CROSS_VISIT_DOSE_001",  // Back-end rule ID
      "trigger": "ON_SUBMIT",
      "isActive": true
    },
    {
      "ruleId": "DATE_WINDOW_CHECK_001",
      "trigger": "ON_SAVE",
      "isActive": true
    }
  ]
}
```

## Workflow Implementation

### 1. CRF Creation (Front-End)

**Step 1**: Design CRF structure
- Add sections
- Add controls (text, number, date, select, etc.)
- Configure basic properties

**Step 2**: Configure Simple Rules
- Set min/max for numeric fields
- Mark fields as required
- Add required-if conditions
- Add show/hide rules

**Step 3**: Reference Back-End Rules (Optional)
- Select from list of available back-end rules
- Assign to CRF or specific controls
- Configure trigger (ON_SAVE, ON_SUBMIT)

### 2. Rule Definition (Back-End)

**Step 1**: Developer writes rule specification
- Document rule logic
- Define rule ID
- Specify trigger conditions

**Step 2**: Implement in rule engine
- Code rule in C#/Java
- Or configure in rule engine DSL
- Add to rule registry

**Step 3**: Deploy via change control
- Code review
- Testing
- Deployment
- Documentation update

### 3. Runtime Execution

**Client-Side (Immediate)**:
```javascript
// Simple rules run on value change
const handleValueChange = (controlId, value) => {
  // Validate min/max
  if (control.properties.min !== null && value < control.properties.min) {
    showError(`Value must be >= ${control.properties.min}`)
    return
  }
  
  // Evaluate show/hide rules
  evaluateRules(control.properties.rules)
  
  // Update form state
  updateFormValue(controlId, value)
}
```

**Server-Side (On Save/Submit)**:
```csharp
[HttpPost("submit")]
public async Task<IActionResult> SubmitCRF([FromBody] CrfSubmissionDto data)
{
    // 1. Validate simple rules (re-validate on server)
    var simpleRuleErrors = ValidateSimpleRules(data);
    if (simpleRuleErrors.Any())
        return BadRequest(simpleRuleErrors);
    
    // 2. Execute complex back-end rules
    var complexRuleDiscrepancies = await _ruleEngine.ExecuteAsync(
        crfId: data.CRFId,
        formData: data.FormValues,
        trigger: "ON_SUBMIT"
    );
    
    // 3. Generate discrepancy notes
    if (complexRuleDiscrepancies.Any(d => d.Severity == "BLOCKING"))
    {
        return BadRequest(new {
            isSuccess = false,
            discrepancies = complexRuleDiscrepancies
        });
    }
    
    // 4. Save data
    await _dataService.SaveCRFData(data);
    
    return Ok(new { isSuccess = true });
}
```

## Clinical & Compliance Considerations

### Pros ✅

1. **Good Balance**: Flexibility for designers + control for IT
2. **Fast CRF Setup**: Designers can build CRFs without programming
3. **Strict Control**: Complex rules go through SDLC and validation
4. **Maintainable**: Advanced logic in real programming language
5. **Regulatory Friendly**: Complex rules validated and audited

### Risks & Controls ⚠️

1. **Risk**: Mismatch between designer expectations and back-end implementation
   - **Control**: Strong communication, formal rule specification documents

2. **Risk**: Rule changes require deployment
   - **Control**: Change control process, regression testing, training

3. **Risk**: Audit trail complexity
   - **Control**: Track both UI configuration changes and rule code versions

4. **Risk**: Rule specification ambiguity
   - **Control**: Formal Rule Specification Document (RSD) / Data Validation Plan (DVP)

## Best Practices

### Front-End Simple Rules

1. **Keep it Simple**: Only allow rules that can be clearly expressed in UI
2. **Immediate Feedback**: Run validation on data entry
3. **Clear Messages**: Provide user-friendly error messages
4. **Documentation**: Tooltips explaining rule behavior

### Back-End Complex Rules

1. **Formal Specification**: Document all rules in RSD/DVP
2. **Version Control**: Track rule code versions
3. **Testing**: Comprehensive test cases for each rule
4. **Change Control**: Formal process for rule changes
5. **Audit Trail**: Log all rule executions and results

## Rule Specification Document Template

```markdown
# Rule Specification: CROSS_VISIT_DOSE_001

## Rule ID
CROSS_VISIT_DOSE_001

## Rule Name
Dose Decrease Validation Across Visits

## Category
Cross-Visit Validation

## Trigger
ON_SUBMIT

## Severity
BLOCKING

## Description
Dose cannot decrease from previous visit unless toxicity occurred.

## Expression (Pseudo-code)
IF CurrentVisit.Dose < PreviousVisit.Dose 
   AND CurrentVisit.HasToxicity == false
THEN BLOCK submission

## Test Cases
1. Current dose = 100, Previous = 80, Toxicity = No → PASS
2. Current dose = 80, Previous = 100, Toxicity = No → FAIL
3. Current dose = 80, Previous = 100, Toxicity = Yes → PASS

## Implementation
Back-End Rule Engine (C#)

## Version
1.0

## Last Updated
2025-12-15
```

## Summary

This implementation follows **Option 2** architecture:

- ✅ CRFs designed dynamically in front-end
- ✅ Simple rules configurable in UI (min/max, required-if, show/hide)
- ✅ Complex rules implemented in back-end rule engine
- ✅ Simple rules run immediately (client-side)
- ✅ Complex rules run on save/submit (server-side)
- ✅ Clear separation between front-end and back-end rules
- ✅ Supports regulatory compliance requirements

The front-end sends both simple rules (embedded in control properties) and references to back-end rules (rule IDs) in the API payload, allowing the back-end to execute the appropriate rule engine logic.
