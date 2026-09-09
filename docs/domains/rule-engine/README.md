# Rule Engine Foundation (Phase 1)

This module introduces a canonical rule pipeline for eCRF:

1. **Compile** heterogeneous UI/backend rules into a normalized model.
2. **Index dependencies** for incremental execution.
3. **Run** a runtime facade that returns deterministic patch envelopes and traces.

## Why this exists

Rule behavior is currently spread across multiple UI files and helper layers.
This foundation creates a stable contract so future changes are safer, faster,
and easier to debug.

## Files

- `contracts.js` - canonical shapes and constants.
- `compiler.js` - rule normalization into IR-like objects.
- `dependencyGraph.js` - dependency index + impacted rule selection.
- `runtime.js` - phase-1 runtime facade with trace output.
- `rolloutGate.js` - rollout scope and runtime gating config helpers.
- `compareMode.js` - compare status summary model.
- `applyAdapter.js` - patch-to-UI adapter helpers.
- `mismatchSampler.js` - sampled mismatch collector (local stub + uploader hook).
- `runtimeMode.js` - one-command runtime mode switch.
- `parityReport.js` - runtime-vs-legacy parity report helper.
- `perfMetrics.js` - runtime perf tracker.
- `reportExport.js` - JSON export helper for parity evidence.
- `index.js` - public exports.
- `PHASE_RUNBOOK.md` - rollout/ops runbook for teams.
- `IMPLEMENTATION_STATUS.md` - current progress + pending items.

## Current Scope (Phase 1 + Phase 2 partial)

- Non-breaking: no hard switch from existing rule execution paths.
- Incremental selection and tracing are implemented.
- Deterministic patch reducer is implemented for:
  - visibility (show/hide)
  - readonly (enable/disable)
  - date-bound source inference (`minDateFromFieldId` / `maxDateFromFieldId`)
  - validation/submit guard message envelopes
- Phase 2.5 shadow capabilities:
  - compute evaluation callback support in runtime
  - mismatch diagnostics (runtime patches vs legacy effective props)
  - pilot patch-application flag for controlled per-form rollout

## Next Phases

### Phase 2
- Add required + compute property reducers.
- Expand conflict policy for per-property merge families.
- Add row-scoped table execution planner.

### Phase 3
- Wire runtime in data-entry flow behind feature flag.
- Dual-run compare mode (legacy engine vs runtime output).
- Performance metrics (p50/p95 eval latency and impacted-rule count).

### Phase 3 start (implemented)
- structured parity report helper (`buildParityReport`)
- in-memory runtime perf tracker (`createRuntimePerfTracker`)
- shadow logs now include parity/perf summary
- latest report is exposed on `window.__crfRuleRuntimeLastParityReport`

### Phase 3.1 (implemented)
- JSON export helper (`downloadParityReportJson`)
- browser shortcut to download latest report:
  - `window.__crfRuleRuntimeDownloadLastParityReport()`

### Phase 4 start (implemented)
- rollout gate utilities:
  - `readRuleRuntimeRolloutConfig`
  - `isRuleRuntimePilotAllowed`
  - `isRuleRuntimePrimaryAllowed`
- compare mode status helper:
  - `buildCompareModeStatus`
- pilot apply adapter helpers:
  - `buildPilotControlOverrides`
  - `applyValuePatchesToFormSlice`

### Phase 4.2 + 5 prep (implemented)
- auto-fallback path when compare status is `fail` (flag controlled)
- local mismatch sampler + flush/get browser helpers
- runtime-primary toggle path for selected study/form scopes

### Phase 5 (execution controls implemented)
- runtime mode utility:
  - `setRuleRuntimeMode("off" | "shadow" | "pilot" | "primary", options)`
  - `clearRuleRuntimeMode()`
  - `getRuleRuntimeModeConfig()`
- browser helpers exposed from eCRF page:
  - `window.__crfRuleRuntimeSetMode(...)`
  - `window.__crfRuleRuntimeClearMode()`
  - `window.__crfRuleRuntimeGetMode()`

## Pilot Flags (localStorage)

- `crfRuleRuntimeShadow=1` - enable shadow execution logs.
- `crfRuleRuntimePilot=1` - apply runtime property patches in pilot mode.
- `crfRuleRuntimePilotFormId=<form_id>` - optional form gate for pilot mode.
- `crfRuleRuntimePilotApplyValues=1` - optional value patch apply (compute rollout).
- `crfRuleRuntimeCompareMode=1` - include compare status envelope.
- `crfRuleRuntimePilotFormIds=<id1,id2>` - optional CSV form allowlist.
- `crfRuleRuntimePilotStudyIds=<study1,study2>` - optional CSV study allowlist.
- `crfRuleRuntimeMismatchWarnThreshold=<number>` - compare warn threshold.
- `crfRuleRuntimePrimary=1` - enable runtime-primary path.
- `crfRuleRuntimePrimaryFormIds=<id1,id2>` - runtime-primary form allowlist.
- `crfRuleRuntimePrimaryStudyIds=<study1,study2>` - runtime-primary study allowlist.
- `crfRuleRuntimeAutoFallbackOnFail=1` - disable runtime apply on compare fail.
- `crfRuleRuntimeMismatchSampleRate=<0..1>` - mismatch sampling probability.

### Phase 4
- Promote runtime as primary executor.
- Retire duplicated UI-embedded rule side effects.
