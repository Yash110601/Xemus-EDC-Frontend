# CRF Data Entry Guide

This document explains how to display CRF forms for data entry and store the entered data in the database.

## Overview

**CRF Design** (Designer) → Creates form structure with rules  
**CRF Data Entry** (User) → Fills form with actual patient/subject data  
**Database** → Stores both CRF design and CRF data entries

## Architecture Flow

```
1. CRF Design Created (Designer)
   ↓
   CRF_Designs Table (Structure + Rules)
   
2. User Opens Data Entry
   ↓
   Load CRF Design from CRF_Designs
   ↓
   Render Form using CRFViewer
   
3. User Enters Data
   ↓
   Form Values Collected
   ↓
   Simple Rules Validated (Client-Side)
   
4. User Clicks Save/Submit
   ↓
   API Call with Form Data
   ↓
   Back-End Rule Engine Execution
   ↓
   CRF_Data_Entries Table (Patient Data)
```

## Front-End Implementation

### 1. Data Entry Page Structure

```jsx
// app/ecrf-data-entry/page.jsx
import CRFViewer from "@/components/crf-designer/CRFViewer"
import { crfService } from "@/lib/services/crf.service"
import { crfDataEntryService } from "@/lib/services/crfDataEntry.service"

export default function ECRFDataEntryPage() {
  const [selectedCRF, setSelectedCRF] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [saving, setSaving] = useState(false)

  // Load CRF design when visit is selected
  const handleVisitSelect = async (visit) => {
    // Get CRF ID for this visit (from study configuration)
    const crfId = visit.crfId
    
    // Load CRF design
    const response = await crfService.getCRFById(crfId)
    if (response.isSuccess) {
      setSelectedCRF(response.data)
      
      // Load existing data if any
      const existingData = await crfDataEntryService.getCRFDataEntries(
        visit.subjectId,
        visit.visitId
      )
      if (existingData.isSuccess && existingData.data.length > 0) {
        setFormValues(existingData.data[0].formValues)
      }
    }
  }

  // Handle form value changes
  const handleValueChange = (controlId, value) => {
    setFormValues(prev => ({
      ...prev,
      [controlId]: value
    }))
  }

  // Save as draft
  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      const entryData = {
        subjectId: selectedVisit.subjectId,
        visitId: selectedVisit.visitId,
        crfId: selectedCRF.id,
        formValues: formValues,
        status: "Draft",
        enteredBy: currentUser.id
      }
      
      const response = await crfDataEntryService.saveCRFDataEntry(entryData)
      if (response.isSuccess) {
        toast({ title: "Saved", description: "Data saved as draft" })
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Submit final
  const handleSubmit = async () => {
    setSaving(true)
    try {
      // First save
      const saveResponse = await crfDataEntryService.saveCRFDataEntry({
        subjectId: selectedVisit.subjectId,
        visitId: selectedVisit.visitId,
        crfId: selectedCRF.id,
        formValues: formValues,
        status: "Submitted",
        enteredBy: currentUser.id
      })
      
      if (saveResponse.isSuccess) {
        // Then submit (triggers back-end rule engine)
        const submitResponse = await crfDataEntryService.submitCRFDataEntry(
          saveResponse.data.id,
          {
            formValues: formValues,
            submittedBy: currentUser.id
          }
        )
        
        if (submitResponse.isSuccess) {
          // Check for discrepancies
          if (submitResponse.data.discrepancies?.length > 0) {
            // Show discrepancies
            showDiscrepancies(submitResponse.data.discrepancies)
          } else {
            toast({ title: "Success", description: "CRF submitted successfully" })
            // Close or navigate away
          }
        }
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {selectedCRF && (
        <CRFViewer
          crfData={selectedCRF}
          isPreviewMode={false} // Data entry mode
          formValues={formValues}
          onValueChange={handleValueChange}
          onSave={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
```

### 2. Update CRFViewer for Data Entry Mode

The `CRFViewer` component needs to support:
- Data entry mode (not just preview)
- Form value binding
- Save/Submit handlers
- Discrepancy display

## API Endpoints

### Save CRF Data Entry

**POST** `/api/crf-data/save`

**Request Body**:
```json
{
  "subjectId": "SUBJ-001",
  "visitId": "VISIT-001",
  "crfId": "crf_1234567890",
  "formValues": {
    "ctrl_age": 25,
    "ctrl_gender": "Male",
    "ctrl_visitDate": "2025-12-15",
    "ctrl_bp": "120/80",
    "ctrl_heartRate": 72
  },
  "status": "Draft",
  "enteredBy": "user_123",
  "enteredAt": "2025-12-15T10:30:00.000Z"
}
```

**Response**:
```json
{
  "isSuccess": true,
  "data": {
    "id": "entry_1234567890",
    "message": "CRF data saved successfully"
  }
}
```

### Submit CRF Data Entry

**POST** `/api/crf-data/submit/{entryId}`

**Request Body**:
```json
{
  "formValues": {
    "ctrl_age": 25,
    "ctrl_gender": "Male",
    "ctrl_visitDate": "2025-12-15",
    "ctrl_bp": "120/80",
    "ctrl_heartRate": 72
  },
  "submittedBy": "user_123",
  "submittedAt": "2025-12-15T10:30:00.000Z"
}
```

**Response** (with discrepancies):
```json
{
  "isSuccess": false,
  "data": {
    "id": "entry_1234567890",
    "discrepancies": [
      {
        "ruleId": "INC_AGE_001",
        "message": "Subject is outside permitted age range (18–25 years).",
        "severity": "BLOCKING",
        "fieldId": "ctrl_age",
        "fieldLabel": "Age"
      }
    ]
  },
  "message": "CRF submission blocked due to validation errors"
}
```

## Database Table Structure

### Option 1: Single Table (Simplest)

```sql
CREATE TABLE CRF_Data_Entries (
    Id VARCHAR(50) PRIMARY KEY,
    SubjectId VARCHAR(50) NOT NULL,
    VisitId VARCHAR(50) NOT NULL,
    CRFId VARCHAR(50) NOT NULL,
    FormValues JSON NOT NULL, -- Store all form values as JSON
    Status VARCHAR(20) NOT NULL, -- Draft, Submitted, Locked, etc.
    EnteredBy VARCHAR(100),
    EnteredAt DATETIME,
    SubmittedBy VARCHAR(100),
    SubmittedAt DATETIME,
    LockedAt DATETIME,
    LockedBy VARCHAR(100),
    Version INT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_subject (SubjectId),
    INDEX idx_visit (VisitId),
    INDEX idx_crf (CRFId),
    INDEX idx_status (Status)
)
```

**Example Data**:
```json
{
  "Id": "entry_123",
  "SubjectId": "SUBJ-001",
  "VisitId": "VISIT-001",
  "CRFId": "crf_1234567890",
  "FormValues": {
    "ctrl_age": 25,
    "ctrl_gender": "Male",
    "ctrl_visitDate": "2025-12-15",
    "ctrl_bp": "120/80",
    "ctrl_heartRate": 72
  },
  "Status": "Submitted",
  "EnteredBy": "user_123",
  "EnteredAt": "2025-12-15T10:00:00",
  "SubmittedBy": "user_123",
  "SubmittedAt": "2025-12-15T10:30:00"
}
```

### Option 2: Normalized (Recommended for Production)

```sql
-- Main Entry Table
CREATE TABLE CRF_Data_Entries (
    Id VARCHAR(50) PRIMARY KEY,
    SubjectId VARCHAR(50) NOT NULL,
    VisitId VARCHAR(50) NOT NULL,
    CRFId VARCHAR(50) NOT NULL,
    Status VARCHAR(20) NOT NULL, -- Draft, Submitted, Locked
    EnteredBy VARCHAR(100),
    EnteredAt DATETIME,
    SubmittedBy VARCHAR(100),
    SubmittedAt DATETIME,
    LockedAt DATETIME,
    LockedBy VARCHAR(100),
    Version INT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_subject_visit (SubjectId, VisitId),
    INDEX idx_crf (CRFId),
    INDEX idx_status (Status)
)

-- Field Values Table
CREATE TABLE CRF_Field_Values (
    Id VARCHAR(50) PRIMARY KEY,
    EntryId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Data_Entries(Id) ON DELETE CASCADE,
    ControlId VARCHAR(50) NOT NULL,
    FieldValue NVARCHAR(MAX), -- Store as string, convert based on control type
    DataType VARCHAR(20), -- text, number, date, boolean, etc.
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_entry (EntryId),
    INDEX idx_control (ControlId),
    UNIQUE(EntryId, ControlId) -- One value per control per entry
)

-- Discrepancy Notes Table
CREATE TABLE CRF_Discrepancies (
    Id VARCHAR(50) PRIMARY KEY,
    EntryId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Data_Entries(Id) ON DELETE CASCADE,
    RuleId VARCHAR(50),
    ControlId VARCHAR(50),
    Message NVARCHAR(500) NOT NULL,
    Severity VARCHAR(10), -- BLOCKING, WARNING
    Status VARCHAR(20), -- Open, Answered, Closed
    CreatedBy VARCHAR(100),
    CreatedAt DATETIME,
    AnsweredBy VARCHAR(100),
    AnsweredAt DATETIME,
    Answer NVARCHAR(MAX),
    INDEX idx_entry (EntryId),
    INDEX idx_status (Status)
)
```

## Back-End API Implementation (.NET 8)

### Save CRF Data Entry Controller

```csharp
[ApiController]
[Route("api/crf-data")]
public class CRFDataEntryController : ControllerBase
{
    private readonly CRFDataEntryService _dataEntryService;
    private readonly IRuleEngine _ruleEngine;

    [HttpPost("save")]
    public async Task<IActionResult> SaveCRFDataEntry([FromBody] CRFDataEntryDto entryData)
    {
        try
        {
            // 1. Validate required fields
            if (string.IsNullOrEmpty(entryData.SubjectId) || 
                string.IsNullOrEmpty(entryData.CRFId))
            {
                return BadRequest(new { 
                    isSuccess = false, 
                    message = "SubjectId and CRFId are required" 
                });
            }

            // 2. Load CRF design to validate structure
            var crfDesign = await _crfService.GetCRFById(entryData.CRFId);
            if (crfDesign == null)
            {
                return NotFound(new { 
                    isSuccess = false, 
                    message = "CRF design not found" 
                });
            }

            // 3. Validate simple rules (min/max, required)
            var simpleRuleErrors = ValidateSimpleRules(crfDesign, entryData.FormValues);
            if (simpleRuleErrors.Any())
            {
                return BadRequest(new {
                    isSuccess = false,
                    errors = simpleRuleErrors
                });
            }

            // 4. Save entry
            var entry = new CRFDataEntry
            {
                Id = entryData.Id ?? $"entry_{Guid.NewGuid()}",
                SubjectId = entryData.SubjectId,
                VisitId = entryData.VisitId,
                CRFId = entryData.CRFId,
                FormValues = JsonSerializer.Serialize(entryData.FormValues),
                Status = entryData.Status,
                EnteredBy = entryData.EnteredBy,
                EnteredAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _dataEntryService.SaveAsync(entry);

            return Ok(new { 
                isSuccess = true, 
                data = new { id = entry.Id } 
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { 
                isSuccess = false, 
                message = ex.Message 
            });
        }
    }

    [HttpPost("submit/{entryId}")]
    public async Task<IActionResult> SubmitCRFDataEntry(string entryId, [FromBody] CRFDataEntrySubmitDto submitData)
    {
        try
        {
            // 1. Load entry
            var entry = await _dataEntryService.GetByIdAsync(entryId);
            if (entry == null)
                return NotFound();

            // 2. Load CRF design
            var crfDesign = await _crfService.GetCRFById(entry.CRFId);

            // 3. Re-validate simple rules
            var formValues = JsonSerializer.Deserialize<Dictionary<string, object>>(entry.FormValues);
            var simpleRuleErrors = ValidateSimpleRules(crfDesign, formValues);
            if (simpleRuleErrors.Any(e => e.Severity == "BLOCKING"))
            {
                return BadRequest(new {
                    isSuccess = false,
                    discrepancies = simpleRuleErrors
                });
            }

            // 4. Execute complex back-end rules
            var context = new CrfContext
            {
                SubjectId = entry.SubjectId,
                VisitId = entry.VisitId,
                CRFId = entry.CRFId,
                FormValues = formValues
            };

            var discrepancies = await _ruleEngine.ExecuteAsync(context, "ON_SUBMIT");

            // 5. If blocking discrepancies, don't submit
            if (discrepancies.Any(d => d.Severity == "BLOCKING"))
            {
                // Save discrepancies
                await _discrepancyService.CreateDiscrepancies(entryId, discrepancies);

                return BadRequest(new {
                    isSuccess = false,
                    discrepancies = discrepancies.Select(d => new {
                        ruleId = d.RuleId,
                        message = d.Message,
                        severity = d.Severity,
                        fieldId = d.FieldId
                    })
                });
            }

            // 6. Submit entry
            entry.Status = "Submitted";
            entry.SubmittedBy = submitData.SubmittedBy;
            entry.SubmittedAt = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;

            await _dataEntryService.UpdateAsync(entry);

            // 7. Save warnings as discrepancies (non-blocking)
            if (discrepancies.Any(d => d.Severity == "WARNING"))
            {
                await _discrepancyService.CreateDiscrepancies(entryId, 
                    discrepancies.Where(d => d.Severity == "WARNING"));
            }

            return Ok(new { 
                isSuccess = true, 
                data = new { id = entry.Id },
                discrepancies = discrepancies.Where(d => d.Severity == "WARNING")
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { 
                isSuccess = false, 
                message = ex.Message 
            });
        }
    }

    private List<DiscrepancyDto> ValidateSimpleRules(CRFDesign crfDesign, Dictionary<string, object> formValues)
    {
        var errors = new List<DiscrepancyDto>();

        // Validate each control
        foreach (var section in crfDesign.Sections)
        {
            foreach (var control in section.Controls)
            {
                var controlId = control.Id;
                var value = formValues.ContainsKey(controlId) ? formValues[controlId] : null;
                var props = control.Properties;

                // Required field validation
                if (props.Required && (value == null || value.ToString().Trim() == ""))
                {
                    errors.Add(new DiscrepancyDto
                    {
                        ControlId = controlId,
                        Message = $"{control.Label} is required",
                        Severity = "BLOCKING"
                    });
                }

                // Min/Max validation for numbers
                if (control.Type == "number" && value != null)
                {
                    if (props.Min != null && Convert.ToDouble(value) < props.Min)
                    {
                        errors.Add(new DiscrepancyDto
                        {
                            ControlId = controlId,
                            Message = $"{control.Label} must be >= {props.Min}",
                            Severity = "BLOCKING"
                        });
                    }
                    if (props.Max != null && Convert.ToDouble(value) > props.Max)
                    {
                        errors.Add(new DiscrepancyDto
                        {
                            ControlId = controlId,
                            Message = $"{control.Label} must be <= {props.Max}",
                            Severity = "BLOCKING"
                        });
                    }
                }

                // Evaluate control-level rules
                if (props.Rules != null)
                {
                    foreach (var rule in props.Rules)
                    {
                        if (rule.RuleCategory == "validation")
                        {
                            // Evaluate rule expression
                            var conditionMet = EvaluateRuleExpression(rule.RuleExpression, formValues);
                            if (conditionMet)
                            {
                                errors.Add(new DiscrepancyDto
                                {
                                    RuleId = rule.Id,
                                    ControlId = controlId,
                                    Message = rule.Message || rule.RuleExpression,
                                    Severity = "BLOCKING"
                                });
                            }
                        }
                    }
                }
            }
        }

        // Evaluate CRF-level rules
        if (crfDesign.Rules != null)
        {
            foreach (var rule in crfDesign.Rules)
            {
                if (rule.Category == "validation")
                {
                    var conditionMet = EvaluateRuleExpression(rule.Expression, formValues);
                    if (conditionMet)
                    {
                        errors.Add(new DiscrepancyDto
                        {
                            RuleId = rule.Id,
                            Message = rule.Message || rule.Expression,
                            Severity = rule.Severity
                        });
                    }
                }
            }
        }

        return errors;
    }
}
```

## Complete Data Flow

### 1. User Opens Data Entry

```
User selects Patient → Visit
    ↓
Front-End: GET /api/crf/{crfId}
    ↓
Back-End: Load CRF design from CRF_Designs table
    ↓
Return: CRF structure with sections, controls, rules
    ↓
Front-End: Render form using CRFViewer
    ↓
Load existing data: GET /api/crf-data/list?subjectId=X&visitId=Y
    ↓
Populate form with existing values (if draft exists)
```

### 2. User Enters Data

```
User types in form field
    ↓
Front-End: handleValueChange(controlId, value)
    ↓
Update formValues state
    ↓
Evaluate simple rules (client-side)
    - Min/Max validation
    - Required field check
    - Show/Hide rules
    ↓
Update UI (show errors, hide/show fields)
```

### 3. User Clicks Save (Draft)

```
Front-End: POST /api/crf-data/save
    {
      subjectId, visitId, crfId,
      formValues: { ... },
      status: "Draft"
    }
    ↓
Back-End:
    1. Validate simple rules
    2. Save to CRF_Data_Entries table
    3. Return success
    ↓
Front-End: Show "Saved" message
```

### 4. User Clicks Submit

```
Front-End: POST /api/crf-data/submit/{entryId}
    {
      formValues: { ... },
      submittedBy: "user_123"
    }
    ↓
Back-End:
    1. Re-validate simple rules
    2. Execute complex rules (rule engine)
    3. Generate discrepancies
    4. If blocking: Don't submit, return discrepancies
    5. If warnings only: Submit, save warnings as discrepancies
    6. Update entry status to "Submitted"
    ↓
Front-End:
    - If blocking: Show discrepancies, prevent submission
    - If warnings: Show warnings, allow submission
    - If success: Show success, close form
```

## Database Schema Summary

### CRF_Designs Table
- Stores CRF structure (sections, controls)
- Stores simple rules (in properties)
- Stores CRF-level rules

### CRF_Data_Entries Table
- Stores actual patient/subject data
- Links to CRF design via CRFId
- Links to subject/visit
- Stores form values as JSON or normalized

### CRF_Discrepancies Table
- Stores rule violations
- Links to data entry
- Tracks resolution status

## Example: Complete Save Flow

```javascript
// Front-End: Save CRF Data Entry
const handleSave = async () => {
  const entryData = {
    subjectId: "SUBJ-001",
    visitId: "VISIT-001",
    crfId: "crf_1234567890",
    formValues: {
      "ctrl_age": 25,
      "ctrl_gender": "Male",
      "ctrl_visitDate": "2025-12-15",
      "ctrl_bp": "120/80",
      "ctrl_heartRate": 72
    },
    status: "Draft",
    enteredBy: currentUser.id
  }

  const response = await crfDataEntryService.saveCRFDataEntry(entryData)
  // Response: { isSuccess: true, data: { id: "entry_123" } }
}
```

```csharp
// Back-End: Save to Database
public async Task SaveCRFDataEntry(CRFDataEntryDto dto)
{
    var entry = new CRFDataEntry
    {
        Id = $"entry_{Guid.NewGuid()}",
        SubjectId = dto.SubjectId,
        VisitId = dto.VisitId,
        CRFId = dto.CRFId,
        FormValues = JsonSerializer.Serialize(dto.FormValues), // Store as JSON
        Status = "Draft",
        EnteredBy = dto.EnteredBy,
        EnteredAt = DateTime.UtcNow
    };

    await _dbContext.CRFDataEntries.AddAsync(entry);
    await _dbContext.SaveChangesAsync();
}
```

## Summary

1. **Display CRF for Data Entry**: Use `CRFViewer` component with `isPreviewMode={false}`
2. **Collect Form Data**: Track form values in state, update on field changes
3. **Save Draft**: POST to `/api/crf-data/save` with form values
4. **Submit**: POST to `/api/crf-data/submit/{entryId}` - triggers rule engine
5. **Store in DB**: Save to `CRF_Data_Entries` table with form values (JSON or normalized)
6. **Handle Discrepancies**: Show rule violations, allow resolution

The front-end sends form values, back-end validates and stores them, and rule engine generates discrepancies if needed.
