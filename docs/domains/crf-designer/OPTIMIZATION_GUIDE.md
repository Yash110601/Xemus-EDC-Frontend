# CRF Data Entry - Optimization Guide

This document explains the optimizations made to improve usability and performance.

## Key Optimizations

### 1. Custom Hook (`useCRFDataEntry`)

**Location**: `hooks/useCRFDataEntry.js`

**Benefits**:
- ✅ Centralized state management
- ✅ Auto-save functionality (debounced)
- ✅ Automatic data loading
- ✅ Simplified API for components
- ✅ Built-in error handling
- ✅ Loading states management

**Usage**:
```javascript
const {
  crfDesign,        // Loaded CRF design
  formValues,       // Current form values
  loading,          // Loading state
  saving,           // Saving state
  error,            // Error message
  hasUnsavedChanges, // Track unsaved changes
  updateFormValue,  // Update single field
  saveDraft,        // Manual save
  submit,           // Submit form
  canSubmit         // Can submit check
} = useCRFDataEntry(subjectId, visitId, crfId)
```

### 2. Auto-Save Feature

**How it works**:
- Automatically saves draft after 3 seconds of inactivity
- Debounced to prevent excessive API calls
- Shows "Unsaved changes" indicator
- Silent save (no toast notifications)

**Benefits**:
- ✅ Never lose data
- ✅ Better user experience
- ✅ Reduced manual save clicks

### 3. Improved Error Handling

**Service Layer**:
- Fallback to localStorage in development
- Consistent error response structure
- Better error messages

**Component Layer**:
- Visual error indicators
- Loading states
- User-friendly error messages

### 4. Simplified Component Code

**Before** (Complex):
```javascript
const [crfDesign, setCrfDesign] = useState(null)
const [formValues, setFormValues] = useState({})
const [saving, setSaving] = useState(false)
const [currentEntryId, setCurrentEntryId] = useState(null)

// Manual loading logic
// Manual save logic
// Manual error handling
```

**After** (Simple):
```javascript
const {
  crfDesign,
  formValues,
  saving,
  updateFormValue,
  saveDraft,
  submit
} = useCRFDataEntry(subjectId, visitId, crfId)
```

### 5. Better User Feedback

**Visual Indicators**:
- ✅ "Unsaved changes" badge
- ✅ "All changes saved" indicator
- ✅ Loading spinners
- ✅ Auto-save status
- ✅ Error alerts

### 6. Optimized API Calls

**Before**:
- Multiple separate API calls
- Manual state synchronization
- No caching

**After**:
- Single hook manages all calls
- Automatic state sync
- Debounced auto-save reduces calls

## Performance Improvements

### 1. Debounced Auto-Save
- Prevents excessive API calls
- 3-second delay after last change
- Only saves if there are actual changes

### 2. Efficient State Updates
- Single source of truth
- Minimal re-renders
- Optimized form value updates

### 3. Smart Loading
- Only loads when needed
- Caches loaded data
- Prevents duplicate requests

## Usage Example

### Simple Data Entry Page

```javascript
import { useCRFDataEntry } from "@/hooks/useCRFDataEntry"

export default function DataEntryPage() {
  const [selectedVisit, setSelectedVisit] = useState(null)
  
  const {
    crfDesign,
    formValues,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    updateFormValue,
    saveDraft,
    submit
  } = useCRFDataEntry(
    selectedVisit?.subjectId,
    selectedVisit?.visitId,
    selectedVisit?.crfId
  )

  return (
    <div>
      {loading && <Loader />}
      {error && <Alert>{error}</Alert>}
      {crfDesign && (
        <CRFViewer
          crfData={crfDesign}
          initialFormValues={formValues}
          onValueChange={updateFormValue}
        />
      )}
      <Button onClick={saveDraft}>Save</Button>
      <Button onClick={submit}>Submit</Button>
    </div>
  )
}
```

## Benefits Summary

1. **Easier to Use**
   - Simple hook API
   - Less boilerplate code
   - Automatic features (auto-save, loading)

2. **Better Performance**
   - Debounced auto-save
   - Efficient state management
   - Reduced API calls

3. **Better UX**
   - Visual feedback
   - Auto-save prevents data loss
   - Clear error messages

4. **Maintainable**
   - Centralized logic
   - Reusable hook
   - Clean component code

5. **Robust**
   - Error handling
   - Loading states
   - Edge case handling

## Migration Guide

### Old Code
```javascript
// Multiple states
const [crfDesign, setCrfDesign] = useState(null)
const [formValues, setFormValues] = useState({})
const [saving, setSaving] = useState(false)

// Manual loading
useEffect(() => {
  loadCRF()
  loadExistingData()
}, [])

// Manual save
const handleSave = async () => {
  setSaving(true)
  try {
    await saveData()
  } finally {
    setSaving(false)
  }
}
```

### New Code
```javascript
// Single hook
const {
  crfDesign,
  formValues,
  saving,
  updateFormValue,
  saveDraft
} = useCRFDataEntry(subjectId, visitId, crfId)

// Auto-loads, auto-saves
// Just use the values and functions
```

## Future Enhancements

1. **Offline Support**
   - Queue saves when offline
   - Sync when online

2. **Conflict Resolution**
   - Handle concurrent edits
   - Merge strategies

3. **Validation**
   - Real-time validation
   - Field-level errors

4. **Undo/Redo**
   - Form value history
   - Undo changes

5. **Progress Tracking**
   - Completion percentage
   - Required field tracking
