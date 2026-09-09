# CRF Design & Data Entry Demo Guide

This guide shows how to demonstrate CRF design with rules and CRF data entry with validation using locally stored data.

## Prerequisites

1. **CRF Design saved in sessionStorage** - The CRF design must be saved from the CRF Designer first
2. **CRF ID available** - The system will automatically use the latest saved CRF from session

## Demo Flow

### Part 1: CRF Design with Rules

#### Step 1: Open CRF Designer
- Navigate to: `Study Management → CRF Designer`
- Click **Create New** or open an existing CRF

#### Step 2: Configure CRF
- Fill in CRF Configuration:
  - **Name**: "testDemo" (or any name)
  - **Group**: (optional)
  - **Category**: (optional)
  - **Description**: "test"

#### Step 3: Add Controls
- Add a **Section** (e.g., "Section 1")
- Add controls:
  - **Text**: "Name" (controlSize: 6)
  - **Number**: "Age" (controlSize: 6)
  - **Date**: "Bdate" (controlSize: 6)
  - **Radio**: "Gender" (options: Male, Female)

#### Step 4: Add Simple Rules (Properties)
- Select **Age** control
- In Properties Panel:
  - Set `Min = 18`
  - Set `Max = 65`
  - Set `Required = true`

#### Step 5: Add Control-Level Rules
- Select **Bdate** control
- In Properties Panel → Rules section → Click **Create**
- Create rule:
  - **Rule Name**: "TestBdate"
  - **Category**: "compute" (or "show", "hide", "validation")
  - **Expression**: `Age >= 18`
  - **Message**: (optional)

#### Step 6: Add CRF-Level Rules (Optional)
- Click **Rules** button in top toolbar
- Add CRF-level rule:
  - **Rule Name**: "Age Eligibility"
  - **Category**: "validation"
  - **Expression**: `Age < 18 || Age > 65`
  - **Severity**: "HARD"
  - **Message**: "Subject age must be between 18 and 65 years"

#### Step 7: Save CRF Design
- Click **Save** button
- The CRF is now saved to:
  - ✅ **sessionStorage** (for data entry to use immediately)
  - ✅ **localStorage** (fallback)
  - ✅ **API** (if backend is available)

**Note the CRF ID** from console log (e.g., `crf_1765965762698`)

---

### Part 2: CRF Data Entry with Validation

#### Step 1: Open Data Entry Page
- Navigate to: `eCRF Data Entry`
- You'll see a list of sample patients

#### Step 2: Select Patient
- Click on any patient (e.g., `PID-35`)
- The system will show available visits

#### Step 3: Select Visit
- Click on a visit (e.g., `Baseline`)
- The system will:
  1. Load the **latest CRF design** from sessionStorage
  2. Load any **existing data entry** for this patient/visit
  3. Display the CRF form with all controls

#### Step 4: Demonstrate Validation

**A. Simple Property Rules (Min/Max, Required)**
- Try entering **Age = 10** → Should show validation error (min = 18)
- Try entering **Age = 70** → Should show validation error (max = 65)
- Leave **Age** empty → Should show required field error
- Enter **Age = 25** → Valid ✅

**B. Control-Level Rules (Show/Hide, Compute)**
- The **Bdate** field has a rule: `Age >= 18`
- When **Age < 18**: Rule condition not met
- When **Age >= 18**: Rule condition met (if "show" category, field appears)

**C. CRF-Level Rules (if added)**
- If you added CRF-level rules, they will appear as **rule messages** at the top
- **HARD** severity rules show in red (blocking)
- **SOFT** severity rules show in amber (warning)

#### Step 5: Demonstrate Auto-Save
- Enter data in any field
- Wait 3 seconds → See "All changes saved" indicator
- Data is automatically saved to sessionStorage as **Draft**

#### Step 6: Save Draft Manually
- Click **SAVE AS DRAFT** button
- Toast notification: "CRF data saved as draft successfully"
- Data persists in sessionStorage

#### Step 7: Submit CRF
- Fill all required fields
- Click **SUBMIT & CLOSE**
- Status changes to "Submitted"
- Data saved in sessionStorage with status "Submitted"

---

## How It Works (Technical)

### Storage Flow

```
1. CRF Designer
   ↓
   Save CRF Design
   ↓
   saveCRFToSession(crfData)
   ↓
   sessionStorage: "crf_designs_session"
   {
     id: "crf_1765965762698",
     config: {...},
     sections: [...],
     rules: [...],  // CRF-level rules
     // Each control has: properties.rules[]  // Control-level rules
   }

2. Data Entry Page
   ↓
   User selects Visit
   ↓
   handleVisitSelect(visitId)
   ↓
   Gets latest CRF from sessionStorage
   ↓
   useCRFDataEntry(subjectId, visitId, crfId)
   ↓
   Loads CRF design from session
   ↓
   Renders form with CRFViewer
   ↓
   Rules execute automatically:
   - useRuleEvaluation (control-level rules)
   - CRFViewer evaluates CRF-level rules
   ↓
   User enters data
   ↓
   Auto-save to sessionStorage (every 3 seconds)
   ↓
   saveCRFDataEntryToSession(entryData)
   ↓
   sessionStorage: "crf_data_entries_session"
```

### Validation Execution

1. **Property Rules** (Min/Max, Required):
   - Validated by `ControlRenderer` component
   - Shows inline errors

2. **Control-Level Rules** (Show/Hide, Enable/Disable, Required-If):
   - Evaluated by `useRuleEvaluation` hook
   - Applied dynamically as user types
   - Uses `ruleEvaluator.js` to evaluate expressions

3. **CRF-Level Rules**:
   - Evaluated in `CRFViewer` component
   - Shows rule messages at top of form
   - Evaluated on every form value change

### Rule Categories

- **show**: Show field when condition is true
- **hide**: Hide field when condition is true
- **enable**: Enable field when condition is true
- **disable**: Disable field when condition is true
- **validation**: Show error message when condition is true
- **compute**: Compute value when condition is true

---

## Demo Checklist

### CRF Design Demo
- [ ] Create CRF with name and configuration
- [ ] Add section with multiple controls
- [ ] Set Min/Max values on number field
- [ ] Set Required flag on field
- [ ] Create control-level rule (show/hide)
- [ ] Create CRF-level rule (validation)
- [ ] Save CRF design
- [ ] Verify CRF saved to sessionStorage

### Data Entry Demo
- [ ] Open Data Entry page
- [ ] Select patient
- [ ] Select visit
- [ ] Verify CRF form loads from session
- [ ] Test Min/Max validation
- [ ] Test Required field validation
- [ ] Test Show/Hide rule (change Gender → see Pregnancy Details appear/disappear)
- [ ] Test CRF-level rule messages (if added)
- [ ] Verify auto-save works (wait 3 seconds)
- [ ] Save as draft manually
- [ ] Submit CRF
- [ ] Verify data saved in sessionStorage

---

## Troubleshooting

### "CRF design not found in this browser session"
- **Solution**: Go back to CRF Designer and save the CRF first
- The CRF must be saved to sessionStorage before data entry can use it

### Rules not executing
- **Check**: Ensure rules are saved in the CRF design
- **Check**: Verify rule expressions use correct field names/labels
- **Check**: Open browser console for rule evaluation errors

### Auto-save not working
- **Check**: Ensure `subjectId`, `visitId`, and `crfId` are all set
- **Check**: Wait 3 seconds after last change
- **Check**: Browser console for errors

### Validation not showing
- **Check**: Ensure `showSaveButtons={true}` is passed to CRFViewer
- **Check**: Rules must have correct category (validation, show, hide, etc.)
- **Check**: Rule expressions must be valid JavaScript expressions

---

## Example CRF Data Structure

```json
{
  "id": "crf_1765965762698",
  "config": {
    "name": "testDemo",
    "group": "",
    "category": "",
    "description": "test"
  },
  "sections": [
    {
      "id": "section_1",
      "name": "Section 1",
      "controls": [
        {
          "id": "ctrl_age",
          "type": "number",
          "label": "Age",
          "properties": {
            "min": 18,
            "max": 65,
            "required": true,
            "rules": []
          }
        },
        {
          "id": "ctrl_bdate",
          "type": "date",
          "label": "Bdate",
          "properties": {
            "rules": [
              {
                "id": "rule_001",
                "ruleName": "TestBdate",
                "ruleCategory": "compute",
                "ruleExpression": "Age >= 18",
                "message": ""
              }
            ]
          }
        }
      ]
    }
  ],
  "rules": [
    {
      "id": "rule_crf_001",
      "name": "Age Eligibility",
      "category": "validation",
      "expression": "Age < 18 || Age > 65",
      "severity": "HARD",
      "message": "Subject age must be between 18 and 65 years"
    }
  ]
}
```

---

## Summary

✅ **CRF Design** → Saved to sessionStorage with all rules  
✅ **Data Entry** → Loads CRF from sessionStorage automatically  
✅ **Validation** → Runs automatically (property rules + control rules + CRF rules)  
✅ **Auto-Save** → Saves draft every 3 seconds  
✅ **Manual Save** → Save as draft or submit  
✅ **All Data** → Stored in sessionStorage (browser session only)

The system is now fully functional for demo purposes using locally stored data!
