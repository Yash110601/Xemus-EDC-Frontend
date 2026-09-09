# Database Storage Options for CRF Design & Rules

This document outlines various database storage strategies for CRF designs and rules, each with their pros and cons.

## Option 1: JSON Storage (Simplest)

### Structure
Store entire CRF design as JSON in a single table.

```sql
CREATE TABLE CRF_Designs (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Group NVARCHAR(100),
    Category NVARCHAR(100),
    Description NVARCHAR(MAX),
    Remarks NVARCHAR(MAX),
    IsFinalPrint CHAR(1),
    Sections JSON, -- All sections with controls and their rules
    Rules JSON, -- CRF-level rules
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    CreatedBy VARCHAR(100),
    UpdatedBy VARCHAR(100),
    Status VARCHAR(50),
    Version INT DEFAULT 1
)
```

### Pros
- ✅ Simple implementation
- ✅ Fast to save/load
- ✅ Easy to version (store multiple versions)
- ✅ Flexible schema (easy to add new fields)
- ✅ Good for prototyping

### Cons
- ❌ Hard to query specific rules or controls
- ❌ No referential integrity
- ❌ Difficult to update individual rules
- ❌ Can't easily find which CRFs use a specific rule
- ❌ Large JSON fields can be slow

### When to Use
- Prototyping
- Small-scale applications
- When you don't need to query rules separately
- When CRF designs are mostly read-only

---

## Option 2: Fully Normalized (Most Flexible)

### Structure
Separate tables for each entity.

```sql
-- Main CRF Table
CREATE TABLE CRF_Designs (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Group NVARCHAR(100),
    Category NVARCHAR(100),
    Description NVARCHAR(MAX),
    Remarks NVARCHAR(MAX),
    IsFinalPrint CHAR(1),
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    CreatedBy VARCHAR(100),
    UpdatedBy VARCHAR(100),
    Status VARCHAR(50),
    Version INT DEFAULT 1
)

-- Sections Table
CREATE TABLE CRF_Sections (
    Id VARCHAR(50) PRIMARY KEY,
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id) ON DELETE CASCADE,
    Name NVARCHAR(200) NOT NULL,
    DisplayOrder INT,
    CreatedAt DATETIME
)

-- Controls Table
CREATE TABLE CRF_Controls (
    Id VARCHAR(50) PRIMARY KEY,
    SectionId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Sections(Id) ON DELETE CASCADE,
    Type VARCHAR(50) NOT NULL, -- text, number, date, select, etc.
    Label NVARCHAR(200),
    ControlSize INT, -- 2, 4, 6, 8, 10, 12
    DisplayOrder INT,
    Properties JSON, -- Store control-specific properties as JSON
    CreatedAt DATETIME
)

-- CRF-Level Rules Table
CREATE TABLE CRF_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id) ON DELETE CASCADE,
    Name NVARCHAR(200) NOT NULL,
    Category VARCHAR(50), -- show, hide, enable, disable, compute, validation, submit, retro
    Expression NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(500),
    Severity VARCHAR(10), -- HARD, SOFT
    TargetField VARCHAR(100),
    Trigger VARCHAR(20), -- ON_CHANGE, ON_SUBMIT
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME
)

-- Control-Level Rules (Many-to-Many)
CREATE TABLE Control_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    ControlId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Controls(Id) ON DELETE CASCADE,
    RuleId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Rules(Id) ON DELETE CASCADE,
    CreatedAt DATETIME,
    UNIQUE(ControlId, RuleId)
)

-- Or store control rules directly (if rules are control-specific)
CREATE TABLE Control_Rules_Direct (
    Id VARCHAR(50) PRIMARY KEY,
    ControlId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Controls(Id) ON DELETE CASCADE,
    RuleName NVARCHAR(200) NOT NULL,
    Category VARCHAR(50),
    Expression NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(500),
    Severity VARCHAR(10),
    CreatedAt DATETIME,
    UpdatedAt DATETIME
)
```

### Pros
- ✅ Easy to query specific rules
- ✅ Can find all CRFs using a specific rule
- ✅ Easy to update individual rules
- ✅ Referential integrity
- ✅ Can reuse rules across CRFs
- ✅ Better for reporting and analytics
- ✅ Can index and optimize queries

### Cons
- ❌ More complex to implement
- ❌ More joins required to load full CRF
- ❌ More tables to maintain
- ❌ Slower to save (multiple inserts)

### When to Use
- Production systems
- When you need to query rules separately
- When rules might be reused across CRFs
- When you need detailed reporting

---

## Option 3: Hybrid Approach (Recommended)

### Structure
Store structure in normalized tables, but keep JSON for flexibility.

```sql
-- Main CRF Table
CREATE TABLE CRF_Designs (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Group NVARCHAR(100),
    Category NVARCHAR(100),
    Description NVARCHAR(MAX),
    Remarks NVARCHAR(MAX),
    IsFinalPrint CHAR(1),
    Sections JSON, -- Store sections/controls as JSON for fast loading
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    CreatedBy VARCHAR(100),
    UpdatedBy VARCHAR(100),
    Status VARCHAR(50),
    Version INT DEFAULT 1
)

-- CRF-Level Rules (Normalized for querying)
CREATE TABLE CRF_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id) ON DELETE CASCADE,
    Name NVARCHAR(200) NOT NULL,
    Category VARCHAR(50),
    Expression NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(500),
    Severity VARCHAR(10),
    TargetField VARCHAR(100),
    Trigger VARCHAR(20),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_crfid (CRFId)
)

-- Control Rules (Normalized)
CREATE TABLE Control_Rules (
    Id VARCHAR(50) PRIMARY KEY,
    ControlId VARCHAR(50) NOT NULL, -- Reference to control ID in JSON
    CRFId VARCHAR(50) FOREIGN KEY REFERENCES CRF_Designs(Id) ON DELETE CASCADE,
    RuleName NVARCHAR(200) NOT NULL,
    Category VARCHAR(50),
    Expression NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(500),
    Severity VARCHAR(10),
    CreatedAt DATETIME,
    UpdatedAt DATETIME,
    INDEX idx_crfid (CRFId),
    INDEX idx_controlid (ControlId)
)
```

### Pros
- ✅ Fast to load full CRF (single JSON read)
- ✅ Can still query rules separately
- ✅ Flexible for control properties
- ✅ Good balance of performance and queryability
- ✅ Easy to version CRF structure

### Cons
- ❌ Control rules reference JSON structure (no FK)
- ❌ Need to sync JSON and normalized tables
- ❌ Slightly more complex than pure JSON

### When to Use
- Production systems needing both performance and queryability
- When CRF structure changes frequently
- When you need fast CRF loading but also rule queries

---

## Option 4: Document Database (NoSQL)

### Structure (MongoDB Example)
Store entire CRF as a document.

```javascript
{
  _id: "crf_1234567890",
  name: "Demographics CRF",
  group: "Screening",
  category: "Baseline",
  description: "Patient demographics",
  sections: [
    {
      id: "section_1",
      name: "Patient Information",
      controls: [
        {
          id: "ctrl_123",
          type: "text",
          label: "Patient Name",
          properties: {
            required: true,
            rules: [
              {
                id: "rule_123",
                ruleName: "Name Required",
                ruleCategory: "validation",
                ruleExpression: "Patient Name != ''",
                message: "Name is required"
              }
            ]
          }
        }
      ]
    }
  ],
  rules: [
    {
      id: "rule_crf_001",
      name: "Eligibility Check",
      category: "validation",
      expression: "Age >= 18",
      message: "Age must be 18+",
      severity: "HARD"
    }
  ],
  createdAt: ISODate("2025-12-15T10:00:00Z"),
  updatedAt: ISODate("2025-12-15T10:30:00Z"),
  version: 1
}
```

### Pros
- ✅ Natural fit for nested structures
- ✅ Fast reads/writes
- ✅ Easy to version (store multiple versions)
- ✅ Flexible schema
- ✅ Good for complex nested data

### Cons
- ❌ No referential integrity
- ❌ Harder to query across documents
- ❌ May need separate collection for rule queries
- ❌ Less familiar to SQL developers

### When to Use
- When using MongoDB/CouchDB/etc.
- When CRF structure is very nested
- When you need flexible schema
- When you don't need complex joins

---

## Option 5: Graph Database

### Structure (Neo4j Example)
Store CRF as nodes and relationships.

```
(CRF)-[:HAS_SECTION]->(Section)-[:HAS_CONTROL]->(Control)
(CRF)-[:HAS_RULE]->(Rule)
(Control)-[:HAS_RULE]->(Rule)
(Rule)-[:REFERENCES]->(Control)  // Rule references other controls
```

### Pros
- ✅ Great for complex rule dependencies
- ✅ Easy to find rule relationships
- ✅ Good for rule impact analysis
- ✅ Natural representation of relationships

### Cons
- ❌ Overkill for simple CRFs
- ❌ Less common in enterprise apps
- ❌ Requires specialized knowledge
- ❌ May be harder to integrate

### When to Use
- Complex rule dependencies
- Need to analyze rule relationships
- Already using graph database
- Rule impact analysis required

---

## Option 6: Time-Series + JSON Hybrid

### Structure
Store CRF structure in JSON, rules in time-series table for versioning.

```sql
-- CRF Structure (JSON)
CREATE TABLE CRF_Designs (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(200),
    Sections JSON,
    CurrentVersion INT,
    CreatedAt DATETIME,
    UpdatedAt DATETIME
)

-- Rules with Versioning (Time-Series)
CREATE TABLE CRF_Rules_History (
    Id VARCHAR(50),
    CRFId VARCHAR(50),
    RuleName NVARCHAR(200),
    Category VARCHAR(50),
    Expression NVARCHAR(MAX),
    Message NVARCHAR(500),
    Severity VARCHAR(10),
    Version INT,
    ValidFrom DATETIME,
    ValidTo DATETIME,
    IsActive BIT,
    PRIMARY KEY (Id, Version)
)
```

### Pros
- ✅ Full audit trail
- ✅ Can see rule changes over time
- ✅ Can rollback to previous versions
- ✅ Good for compliance

### Cons
- ❌ More complex queries
- ❌ More storage required
- ❌ Need to manage versioning logic

### When to Use
- Regulatory compliance required
- Need full audit trail
- Need to track rule changes
- Clinical trial systems (ICH-GCP)

---

## Recommendation Matrix

| Scenario | Recommended Option |
|----------|-------------------|
| Prototype/MVP | Option 1 (JSON) |
| Small scale (< 100 CRFs) | Option 1 (JSON) |
| Production, moderate scale | Option 3 (Hybrid) |
| Production, large scale | Option 2 (Normalized) |
| Need rule reuse | Option 2 (Normalized) |
| Need fast CRF loading | Option 3 (Hybrid) |
| Using MongoDB | Option 4 (Document DB) |
| Complex rule dependencies | Option 5 (Graph DB) |
| Regulatory compliance | Option 6 (Time-Series) |
| Need rule analytics | Option 2 or 3 |

---

## Implementation Example: Hybrid Approach (Recommended)

### Save CRF API Handler (C# .NET 8)

```csharp
[HttpPost("save")]
public async Task<IActionResult> SaveCRF([FromBody] CRFDesignDto crfData)
{
    using var transaction = await _dbContext.Database.BeginTransactionAsync();
    
    try
    {
        // 1. Save/Update CRF Design
        var crf = await _dbContext.CRFDesigns
            .FirstOrDefaultAsync(c => c.Id == crfData.Id);
            
        if (crf == null)
        {
            crf = new CRFDesign
            {
                Id = crfData.Id,
                Name = crfData.Config.Name,
                Group = crfData.Config.Group,
                Category = crfData.Config.Category,
                Description = crfData.Config.Description,
                Sections = JsonSerializer.Serialize(crfData.Sections), // Store as JSON
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.CRFDesigns.Add(crf);
        }
        else
        {
            crf.Name = crfData.Config.Name;
            crf.Group = crfData.Config.Group;
            crf.Sections = JsonSerializer.Serialize(crfData.Sections);
            crf.UpdatedAt = DateTime.UtcNow;
        }
        
        // 2. Save CRF-Level Rules
        var existingRules = await _dbContext.CRFRules
            .Where(r => r.CRFId == crfData.Id)
            .ToListAsync();
            
        _dbContext.CRFRules.RemoveRange(existingRules);
        
        foreach (var rule in crfData.Rules)
        {
            _dbContext.CRFRules.Add(new CRFRule
            {
                Id = rule.Id,
                CRFId = crfData.Id,
                Name = rule.Name,
                Category = rule.Category,
                Expression = rule.Expression,
                Message = rule.Message,
                Severity = rule.Severity,
                CreatedAt = DateTime.UtcNow
            });
        }
        
        // 3. Save Control-Level Rules
        var allControlIds = crfData.Sections
            .SelectMany(s => s.Controls.Select(c => c.Id))
            .ToList();
            
        var existingControlRules = await _dbContext.ControlRules
            .Where(r => r.CRFId == crfData.Id && allControlIds.Contains(r.ControlId))
            .ToListAsync();
            
        _dbContext.ControlRules.RemoveRange(existingControlRules);
        
        foreach (var section in crfData.Sections)
        {
            foreach (var control in section.Controls)
            {
                if (control.Properties?.Rules != null)
                {
                    foreach (var rule in control.Properties.Rules)
                    {
                        _dbContext.ControlRules.Add(new ControlRule
                        {
                            Id = rule.Id,
                            ControlId = control.Id,
                            CRFId = crfData.Id,
                            RuleName = rule.RuleName,
                            Category = rule.RuleCategory,
                            Expression = rule.RuleExpression,
                            Message = rule.Message,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }
        
        await _dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        
        return Ok(new { isSuccess = true, data = new { id = crf.Id } });
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return BadRequest(new { isSuccess = false, message = ex.Message });
    }
}
```

### Load CRF API Handler

```csharp
[HttpGet("{id}")]
public async Task<IActionResult> GetCRF(string id)
{
    var crf = await _dbContext.CRFDesigns.FindAsync(id);
    if (crf == null) return NotFound();
    
    // Load CRF-level rules
    var crfRules = await _dbContext.CRFRules
        .Where(r => r.CRFId == id && r.IsActive)
        .ToListAsync();
    
    // Load control-level rules
    var controlRules = await _dbContext.ControlRules
        .Where(r => r.CRFId == id)
        .ToListAsync();
    
    // Deserialize sections JSON
    var sections = JsonSerializer.Deserialize<List<SectionDto>>(crf.Sections);
    
    // Attach control rules to controls
    foreach (var section in sections)
    {
        foreach (var control in section.Controls)
        {
            var rules = controlRules
                .Where(r => r.ControlId == control.Id)
                .Select(r => new ControlRuleDto
                {
                    Id = r.Id,
                    RuleName = r.RuleName,
                    RuleCategory = r.Category,
                    RuleExpression = r.Expression,
                    Message = r.Message
                })
                .ToList();
                
            if (control.Properties == null)
                control.Properties = new ControlPropertiesDto();
                
            control.Properties.Rules = rules;
        }
    }
    
    var result = new CRFDesignDto
    {
        Id = crf.Id,
        Config = new CRFConfigDto
        {
            Name = crf.Name,
            Group = crf.Group,
            Category = crf.Category,
            Description = crf.Description
        },
        Sections = sections,
        Rules = crfRules.Select(r => new CRFRuleDto
        {
            Id = r.Id,
            Name = r.Name,
            Category = r.Category,
            Expression = r.Expression,
            Message = r.Message,
            Severity = r.Severity
        }).ToList()
    };
    
    return Ok(new { isSuccess = true, data = result });
}
```

---

## Summary

**For most EDC systems, I recommend Option 3 (Hybrid Approach)** because it:
- Provides fast CRF loading (single JSON read)
- Allows rule querying and analytics
- Maintains flexibility for control properties
- Balances performance and functionality
- Is easier to implement than full normalization

Choose based on your specific requirements:
- **Simple/Prototype**: Option 1 (JSON)
- **Production (Recommended)**: Option 3 (Hybrid)
- **Large Scale/Complex**: Option 2 (Normalized)
- **NoSQL Stack**: Option 4 (Document DB)
- **Compliance Critical**: Option 6 (Time-Series)
