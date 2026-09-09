# CRF Data Entry - Database Storage Guide

This document explains how to store CRF data entries (actual patient/subject data) in the database.

## Overview

**CRF Design** → Structure stored in `CRF_Designs` table  
**CRF Data Entry** → Actual data stored in `CRF_Data_Entries` table

## Database Table Structure

### Option 1: JSON Storage (Simplest)

```sql
CREATE TABLE CRF_Data_Entries (
    Id VARCHAR(50) PRIMARY KEY,
    SubjectId VARCHAR(50) NOT NULL,
    VisitId VARCHAR(50) NOT NULL,
    CRFId VARCHAR(50) NOT NULL,
    FormValues JSON NOT NULL, -- All form field values as JSON
    Status VARCHAR(20) NOT NULL, -- Draft, Submitted, Locked, Signed
    EnteredBy VARCHAR(100),
    EnteredAt DATETIME,
    SubmittedBy VARCHAR(100),
    SubmittedAt DATETIME,
    LockedAt DATETIME,
    LockedBy VARCHAR(100),
    SignedAt DATETIME,
    SignedBy VARCHAR(100),
    Version INT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_subject_visit (SubjectId, VisitId),
    INDEX idx_crf (CRFId),
    INDEX idx_status (Status)
)
```

**Example Data**:
```json
{
  "Id": "entry_1234567890",
  "SubjectId": "SUBJ-001",
  "VisitId": "VISIT-001",
  "CRFId": "crf_1234567890",
  "FormValues": {
    "ctrl_age": 25,
    "ctrl_gender": "Male",
    "ctrl_visitDate": "2025-12-15",
    "ctrl_bp": "120/80",
    "ctrl_heartRate": 72,
    "ctrl_temperature": 98.6,
    "ctrl_weight": 70,
    "ctrl_adverseEvents": "None"
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
    Status VARCHAR(20) NOT NULL, -- Draft, Submitted, Locked, Signed
    EnteredBy VARCHAR(100),
    EnteredAt DATETIME,
    SubmittedBy VARCHAR(100),
    SubmittedAt DATETIME,
    LockedAt DATETIME,
    LockedBy VARCHAR(100),
    SignedAt DATETIME,
    SignedBy VARCHAR(100),
    Version INT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_subject_visit (SubjectId, VisitId),
    INDEX idx_crf (CRFId),
    INDEX idx_status (Status)
)

-- Field Values Table (Normalized)
CREATE TABLE CRF_Field_Values (
    Id VARCHAR(50) PRIMARY KEY,
    EntryId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Data_Entries(Id) ON DELETE CASCADE,
    ControlId VARCHAR(50) NOT NULL, -- Reference to control in CRF design
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
    RuleId VARCHAR(50), -- Reference to rule that triggered discrepancy
    ControlId VARCHAR(50), -- Field that has the issue
    Message NVARCHAR(500) NOT NULL,
    Severity VARCHAR(10), -- BLOCKING, WARNING
    Status VARCHAR(20), -- Open, Answered, Closed
    CreatedBy VARCHAR(100),
    CreatedAt DATETIME,
    AnsweredBy VARCHAR(100),
    AnsweredAt DATETIME,
    Answer NVARCHAR(MAX),
    ClosedBy VARCHAR(100),
    ClosedAt DATETIME,
    INDEX idx_entry (EntryId),
    INDEX idx_status (Status),
    INDEX idx_control (ControlId)
)
```

## API Payload Structure

### Save CRF Data Entry

**POST** `/api/crf-data/save`

**Request**:
```json
{
  "id": "entry_1234567890", // Optional - for updates
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
  "enteredBy": "user_123"
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

**Request**:
```json
{
  "formValues": {
    "ctrl_age": 25,
    "ctrl_gender": "Male",
    "ctrl_visitDate": "2025-12-15",
    "ctrl_bp": "120/80",
    "ctrl_heartRate": 72
  },
  "submittedBy": "user_123"
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
        "controlId": "ctrl_age",
        "message": "Subject is outside permitted age range (18–25 years).",
        "severity": "BLOCKING"
      }
    ]
  },
  "message": "CRF submission blocked due to validation errors"
}
```

## Back-End Implementation (.NET 8)

### Save CRF Data Entry

```csharp
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
        if (simpleRuleErrors.Any(e => e.Severity == "BLOCKING"))
        {
            return BadRequest(new {
                isSuccess = false,
                discrepancies = simpleRuleErrors
            });
        }

        // 4. Save or update entry
        CRFDataEntry entry;
        if (!string.IsNullOrEmpty(entryData.Id))
        {
            // Update existing entry
            entry = await _dataEntryService.GetByIdAsync(entryData.Id);
            if (entry == null)
                return NotFound();
            
            entry.FormValues = JsonSerializer.Serialize(entryData.FormValues);
            entry.Status = entryData.Status;
            entry.UpdatedAt = DateTime.UtcNow;
            
            await _dataEntryService.UpdateAsync(entry);
        }
        else
        {
            // Create new entry
            entry = new CRFDataEntry
            {
                Id = $"entry_{Guid.NewGuid()}",
                SubjectId = entryData.SubjectId,
                VisitId = entryData.VisitId,
                CRFId = entryData.CRFId,
                FormValues = JsonSerializer.Serialize(entryData.FormValues),
                Status = entryData.Status,
                EnteredBy = entryData.EnteredBy,
                EnteredAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            
            await _dataEntryService.AddAsync(entry);
        }

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
```

### Submit CRF Data Entry

```csharp
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
        if (crfDesign == null)
            return NotFound();

        // 3. Update form values
        entry.FormValues = JsonSerializer.Serialize(submitData.FormValues);
        entry.UpdatedAt = DateTime.UtcNow;

        // 4. Re-validate simple rules
        var formValues = JsonSerializer.Deserialize<Dictionary<string, object>>(entry.FormValues);
        var simpleRuleErrors = ValidateSimpleRules(crfDesign, formValues);
        if (simpleRuleErrors.Any(e => e.Severity == "BLOCKING"))
        {
            return BadRequest(new {
                isSuccess = false,
                discrepancies = simpleRuleErrors
            });
        }

        // 5. Execute complex back-end rules
        var context = new CrfContext
        {
            SubjectId = entry.SubjectId,
            VisitId = entry.VisitId,
            CRFId = entry.CRFId,
            FormValues = formValues
        };

        var discrepancies = await _ruleEngine.ExecuteAsync(context, "ON_SUBMIT");

        // 6. If blocking discrepancies, don't submit
        if (discrepancies.Any(d => d.Severity == "BLOCKING"))
        {
            // Save discrepancies
            await _discrepancyService.CreateDiscrepancies(entryId, discrepancies);

            return BadRequest(new {
                isSuccess = false,
                discrepancies = discrepancies.Select(d => new {
                    ruleId = d.RuleId,
                    controlId = d.ControlId,
                    message = d.Message,
                    severity = d.Severity
                })
            });
        }

        // 7. Submit entry
        entry.Status = "Submitted";
        entry.SubmittedBy = submitData.SubmittedBy;
        entry.SubmittedAt = DateTime.UtcNow;
        entry.UpdatedAt = DateTime.UtcNow;

        await _dataEntryService.UpdateAsync(entry);

        // 8. Save warnings as discrepancies (non-blocking)
        var warnings = discrepancies.Where(d => d.Severity == "WARNING").ToList();
        if (warnings.Any())
        {
            await _discrepancyService.CreateDiscrepancies(entryId, warnings);
        }

        return Ok(new { 
            isSuccess = true, 
            data = new { id = entry.Id },
            discrepancies = warnings.Select(d => new {
                ruleId = d.RuleId,
                controlId = d.ControlId,
                message = d.Message,
                severity = d.Severity
            })
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
```

## Data Flow Summary

```
1. User Opens Data Entry
   GET /api/crf/{crfId} → Load CRF design
   GET /api/crf-data/list?subjectId=X&visitId=Y → Load existing data
   
2. User Enters Data
   Front-End: Update formValues state
   Simple rules validate immediately (client-side)
   
3. User Clicks Save (Draft)
   POST /api/crf-data/save
   {
     subjectId, visitId, crfId,
     formValues: { controlId: value },
     status: "Draft"
   }
   ↓
   Back-End: Validate simple rules
   Back-End: Save to CRF_Data_Entries table
   ↓
   Response: { isSuccess: true, data: { id: "entry_123" } }
   
4. User Clicks Submit
   POST /api/crf-data/submit/{entryId}
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
     5. If warnings only: Submit, save warnings
     6. Update status to "Submitted"
   ↓
   Response:
     - If blocking: { isSuccess: false, discrepancies: [...] }
     - If success: { isSuccess: true, data: { id: "..." } }
```

## Complete Example

### Front-End Save

```javascript
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
  enteredBy: "user_123"
}

const response = await crfDataEntryService.saveCRFDataEntry(entryData)
// Response: { isSuccess: true, data: { id: "entry_123" } }
```

### Back-End Storage

```csharp
// Save to database
var entry = new CRFDataEntry
{
    Id = "entry_123",
    SubjectId = "SUBJ-001",
    VisitId = "VISIT-001",
    CRFId = "crf_1234567890",
    FormValues = JsonSerializer.Serialize(new {
        ctrl_age = 25,
        ctrl_gender = "Male",
        ctrl_visitDate = "2025-12-15",
        ctrl_bp = "120/80",
        ctrl_heartRate = 72
    }),
    Status = "Draft",
    EnteredBy = "user_123",
    EnteredAt = DateTime.UtcNow
};

await _dbContext.CRFDataEntries.AddAsync(entry);
await _dbContext.SaveChangesAsync();
```

## Summary

1. **CRF Design** stored in `CRF_Designs` table (structure + rules)
2. **CRF Data Entry** stored in `CRF_Data_Entries` table (actual patient data)
3. **Form Values** stored as JSON in `FormValues` column (or normalized in `CRF_Field_Values` table)
4. **Discrepancies** stored in `CRF_Discrepancies` table (rule violations)
5. **API Flow**: Save → Validate → Store → Return ID

The front-end sends form values, back-end validates and stores them in the database table.
