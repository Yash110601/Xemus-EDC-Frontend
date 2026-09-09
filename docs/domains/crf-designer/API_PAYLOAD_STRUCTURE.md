# CRF Design API Payload Structure

This document describes the complete data structure that is sent to the API when saving/submitting a CRF design with rules.

## API Endpoint

**POST** `/api/crf/save` - Save CRF Design  
**POST** `/api/crf/submit/{crfId}` - Submit CRF Design (finalize)

## Complete Payload Structure

```json
{
  "id": "crf_1234567890",
  "config": {
    "name": "Demographics CRF",
    "group": "Screening",
    "category": "Baseline",
    "description": "Patient demographics information",
    "remarks": "Initial screening form",
    "isFinalPrint": "Y",
    "activityRights": []
  },
  "sections": [
    {
      "id": "section_1",
      "name": "Patient Information",
      "controls": [
        {
          "id": "ctrl_1234567890_abc123",
          "type": "text",
          "label": "Patient Name",
          "controlSize": 6,
          "properties": {
            "labelText": "Patient Name",
            "labelPosition": "left",
            "required": true,
            "readonly": false,
            "placeholder": "Enter patient name",
            "tooltip": "",
            "defaultValue": "",
            "maxLength": 500,
            "multiline": false,
            // Control-level rules (rules assigned to this specific control)
            "rules": [
              {
                "id": "rule_1234567890",
                "ruleName": "Name Required Rule",
                "ruleCategory": "validation",
                "ruleExpression": "Patient Name != ''",
                "message": "Patient name is required",
                "createdAt": "2025-12-15T10:30:00.000Z",
                "updatedAt": "2025-12-15T10:30:00.000Z"
              }
            ]
          }
        },
        {
          "id": "ctrl_1234567891_def456",
          "type": "number",
          "label": "Age",
          "controlSize": 6,
          "properties": {
            "labelText": "Age",
            "labelPosition": "left",
            "required": true,
            "readonly": false,
            "placeholder": "",
            "tooltip": "",
            "defaultValue": "",
            "min": 0,
            "max": 120,
            "scale": 0,
            "rules": [
              {
                "id": "rule_1234567891",
                "ruleName": "Age Range Validation",
                "ruleCategory": "validation",
                "ruleExpression": "Age >= 18 && Age <= 65",
                "message": "Age must be between 18 and 65 years",
                "createdAt": "2025-12-15T10:30:00.000Z",
                "updatedAt": "2025-12-15T10:30:00.000Z"
              }
            ]
          }
        },
        {
          "id": "ctrl_1234567892_ghi789",
          "type": "select",
          "label": "Gender",
          "controlSize": 6,
          "properties": {
            "labelText": "Gender",
            "labelPosition": "left",
            "required": true,
            "readonly": false,
            "placeholder": "Select gender",
            "tooltip": "",
            "defaultValue": "",
            "multiple": false,
            "dataSource": "",
            "csvValues": "Male,Female,Other",
            "rules": []
          }
        }
      ]
    }
  ],
  // CRF-level rules (applied to entire CRF, not specific controls)
  "rules": [
    {
      "id": "rule_crf_001",
      "name": "Eligibility Check",
      "category": "validation",
      "expression": "Age >= 18 && Gender == 'Male'",
      "message": "Patient must be male and at least 18 years old",
      "severity": "HARD",
      "targetField": null,
      "trigger": "ON_CHANGE",
      "createdAt": "2025-12-15T10:30:00.000Z"
    },
    {
      "id": "rule_crf_002",
      "name": "Visit Date Validation",
      "category": "validation",
      "expression": "VisitDate >= Today",
      "message": "Visit date cannot be in the future",
      "severity": "SOFT",
      "targetField": null,
      "trigger": "ON_SUBMIT",
      "createdAt": "2025-12-15T10:30:00.000Z"
    }
  ],
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2025-12-15T10:30:00.000Z"
}
```

## Rule Types

### Control-Level Rules
- Stored in `control.properties.rules[]`
- Applied to a specific control
- Examples: Field validation, show/hide based on other fields

### CRF-Level Rules
- Stored in `rules[]` at CRF root level
- Applied to entire CRF
- Examples: Cross-field validation, eligibility checks, date range validation

## Rule Categories

1. **show** - Show Action (show control when condition is met)
2. **hide** - Hide Action (hide control when condition is met)
3. **enable** - Enable Action (enable control when condition is met)
4. **disable** - Disable Action (disable control when condition is met)
5. **compute** - Compute Action (calculate value when condition is met)
6. **validation** - Validation (validate data when condition is met)
7. **submit** - Submit Action (block submit when condition is met)
8. **retro** - Retro Action (retrospective validation)

## Rule Severity

- **HARD** - Blocking rule (prevents save/submit)
- **SOFT** - Warning rule (shows warning but allows save/submit)

## Database Table Structure Recommendation

### CRF Table
```sql
CREATE TABLE CRF_Designs (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Group NVARCHAR(100),
    Category NVARCHAR(100),
    Description NVARCHAR(MAX),
    Remarks NVARCHAR(MAX),
    IsFinalPrint CHAR(1),
    Sections JSON, -- Store sections array as JSON
    Rules JSON, -- Store CRF-level rules as JSON
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    CreatedBy VARCHAR(100),
    UpdatedBy VARCHAR(100),
    Status VARCHAR(50) -- Draft, Submitted, Approved, etc.
)
```

### CRF Rules Table (Alternative - Normalized)
```sql
CREATE TABLE CRF_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id),
    RuleName NVARCHAR(200) NOT NULL,
    Category VARCHAR(50), -- show, hide, enable, disable, compute, validation, submit, retro
    Expression NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(500),
    Severity VARCHAR(10), -- HARD, SOFT
    TargetField VARCHAR(100),
    Trigger VARCHAR(20), -- ON_CHANGE, ON_SUBMIT
    CreatedAt DATETIME,
    UpdatedAt DATETIME
)
```

### Control Rules Table (Alternative - Normalized)
```sql
CREATE TABLE Control_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    ControlId VARCHAR(50) NOT NULL,
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id),
    RuleId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Rules(Id),
    CreatedAt DATETIME
)
```

## API Response Structure

### Success Response
```json
{
  "isSuccess": true,
  "data": {
    "id": "crf_1234567890",
    "message": "CRF Design saved successfully"
  },
  "message": "CRF Design saved successfully"
}
```

### Error Response
```json
{
  "isSuccess": false,
  "message": "Validation failed: CRF Name is required",
  "errors": [
    {
      "field": "config.name",
      "message": "CRF Name is required"
    }
  ]
}
```

## Notes

1. **Control-level rules** are embedded in each control's `properties.rules` array
2. **CRF-level rules** are stored separately in the `rules` array at the root level
3. Rules can reference other fields by their label or ID in the expression
4. The backend should validate rule expressions before saving
5. Rules are evaluated at runtime during data entry/preview
6. HARD rules block save/submit, SOFT rules show warnings only
