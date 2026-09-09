# Option 2 Implementation Summary

This document shows how the current CRF Designer implementation aligns with **Option 2 Architecture**.

## ✅ Current Implementation Status

### Front-End Simple Rules (Already Implemented)

#### 1. Numeric Range Validation ✅
- **Location**: Properties Panel → Number Field → Min/Max fields
- **Implementation**: Lines 408-421 in `PropertiesPanel.jsx`
- **Storage**: `control.properties.min` and `control.properties.max`
- **Validation**: Runs client-side during data entry

#### 2. Required Field ✅
- **Location**: Properties Panel → Required dropdown
- **Implementation**: Lines 156-172 in `PropertiesPanel.jsx`
- **Storage**: `control.properties.required`
- **Validation**: Runs client-side during data entry

#### 3. Show/Hide Rules ✅
- **Location**: Rules Panel or Rule Creation Modal
- **Implementation**: Rule categories include "show" and "hide"
- **Storage**: `control.properties.rules[]` with category "show"/"hide"
- **Validation**: Runs client-side during data entry

#### 4. Enable/Disable Rules ✅
- **Location**: Rules Panel or Rule Creation Modal
- **Implementation**: Rule categories include "enable" and "disable"
- **Storage**: `control.properties.rules[]` with category "enable"/"disable"
- **Validation**: Runs client-side during data entry

#### 5. Required-If (Conditional Required) ✅
- **Location**: Rule Creation Modal → Validation category
- **Implementation**: Can create rules with expression like "FieldA == 'Yes'"
- **Storage**: `control.properties.rules[]` with category "validation"
- **Validation**: Runs client-side during data entry

### CRF-Level Rules ✅
- **Location**: Rules Panel (collapsible section)
- **Implementation**: `RulesPanel.jsx` component
- **Storage**: `crfRules` array at CRF root level
- **Validation**: Runs client-side in preview mode

## 🔄 What Needs to Be Added (Back-End Integration)

### 1. Back-End Rule References

Add UI to select from available back-end rules:

```javascript
// In CRFDesigner.jsx - add state for back-end rule references
const [complexRules, setComplexRules] = useState([])

// Add to API payload
const crfData = {
  // ... existing fields
  complexRules: complexRules.map(r => ({
    ruleId: r.id,           // Back-end rule ID
    trigger: r.trigger,    // ON_SAVE, ON_SUBMIT
    isActive: r.isActive
  }))
}
```

### 2. Back-End Rule Selection UI

Create a component to select from available back-end rules:

```jsx
// BackEndRulesSelector.jsx
const BackEndRulesSelector = ({ selectedRules, onChange, availableRules }) => {
  // Display list of available back-end rules
  // Allow selection and assignment to CRF
  // Configure trigger (ON_SAVE, ON_SUBMIT)
}
```

### 3. API Endpoint for Available Rules

Back-end should provide endpoint to list available rules:

```
GET /api/rules/available
Response: [
  {
    "id": "CROSS_VISIT_DOSE_001",
    "name": "Dose Decrease Validation",
    "description": "Dose cannot decrease unless toxicity",
    "category": "Cross-Visit Validation",
    "trigger": "ON_SUBMIT"
  }
]
```

## 📊 Data Flow

### Save/Submit Flow

```
Front-End (React)
    ↓
1. Collect Simple Rules (from properties)
    - Min/Max values
    - Required flags
    - Show/Hide rules
    - Required-If rules
    ↓
2. Collect CRF-Level Rules
    - From Rules Panel
    ↓
3. Collect Back-End Rule References
    - Rule IDs only
    ↓
4. Send to API
    POST /api/crf/save
    {
      sections: [...],      // With simple rules in properties
      rules: [...],         // CRF-level simple rules
      complexRules: [...]   // Back-end rule references
    }
    ↓
Back-End (.NET 8)
    ↓
1. Save CRF Structure
    - Store sections as JSON
    - Store simple rules in properties
    ↓
2. Store Rule References
    - Link CRF to back-end rules
    ↓
3. Return Success
```

### Runtime Validation Flow

```
Data Entry (Front-End)
    ↓
1. Simple Rules Execute (Immediate)
    - Min/Max validation
    - Required field check
    - Show/Hide rules
    - Required-If rules
    ↓
2. User Clicks Save/Submit
    ↓
3. API Call with Form Data
    POST /api/crf/submit
    {
      crfId: "...",
      formValues: {...}
    }
    ↓
Back-End Rule Engine
    ↓
1. Re-validate Simple Rules
    - Server-side validation
    ↓
2. Execute Complex Rules
    - Cross-visit checks
    - Time-window validation
    - Protocol logic
    ↓
3. Generate Discrepancy Notes
    - Return blocking errors
    - Return warnings
    ↓
4. Response to Front-End
    {
      isSuccess: true/false,
      discrepancies: [...]
    }
```

## 🎯 Next Steps to Complete Option 2

### Phase 1: Enhance Simple Rules (Front-End)
- ✅ Min/Max - Already implemented
- ✅ Required - Already implemented
- ✅ Show/Hide - Already implemented
- ✅ Enable/Disable - Already implemented
- ⚠️ Required-If - Partially implemented (needs UI enhancement)

### Phase 2: Back-End Rule Integration
- [ ] Create API endpoint: `GET /api/rules/available`
- [ ] Create UI component: `BackEndRulesSelector`
- [ ] Add to CRF Designer: Rule selection panel
- [ ] Update API payload: Include `complexRules` array

### Phase 3: Runtime Integration
- [ ] Back-end rule engine implementation
- [ ] Discrepancy note generation
- [ ] API endpoint: `POST /api/crf/submit` with rule execution
- [ ] Front-end discrepancy display

## 📝 Current API Payload (What's Being Sent)

```json
{
  "id": "crf_123",
  "config": {
    "name": "Demographics CRF",
    "group": "Screening",
    "category": "Baseline"
  },
  "sections": [
    {
      "id": "section_1",
      "controls": [
        {
          "id": "ctrl_age",
          "type": "number",
          "properties": {
            "min": 18,              // ← Simple rule (front-end)
            "max": 65,              // ← Simple rule (front-end)
            "required": true,        // ← Simple rule (front-end)
            "rules": [              // ← Simple rules (front-end)
              {
                "id": "rule_001",
                "ruleName": "Show if Gender = Female",
                "ruleCategory": "show",
                "ruleExpression": "Gender == 'Female'"
              }
            ]
          }
        }
      ]
    }
  ],
  "rules": [                       // ← CRF-level simple rules
    {
      "id": "rule_crf_001",
      "name": "Eligibility Check",
      "category": "validation",
      "expression": "Age >= 18",
      "severity": "HARD"
    }
  ],
  "complexRules": []               // ← TODO: Add back-end rule references
}
```

## ✅ Summary

**Current Status**: The implementation already supports **Option 2 Architecture** for simple rules:

- ✅ CRFs designed dynamically in front-end
- ✅ Simple rules configurable in UI (min/max, required, show/hide, enable/disable)
- ✅ Rules stored with CRF design
- ✅ Rules evaluated in preview mode
- ✅ API payload includes all rules

**What's Missing**:
- ⚠️ Back-end rule reference selection UI
- ⚠️ API endpoint to list available back-end rules
- ⚠️ Back-end rule engine execution (to be implemented in .NET 8)

The front-end is **ready** and sends all necessary data. The back-end needs to:
1. Accept the payload structure
2. Store simple rules (already in payload)
3. Execute complex rules (back-end implementation)
4. Return discrepancy notes
