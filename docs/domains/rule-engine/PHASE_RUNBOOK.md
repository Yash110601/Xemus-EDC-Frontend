# eCRF Rule Engine Runbook

This runbook is the operational guide for developers/QA to use the new
rule engine phases safely in real environments.

## 1) Development Modes

Use browser console helpers (available on eCRF page):

- `window.__crfRuleRuntimeSetMode("off")`
- `window.__crfRuleRuntimeSetMode("shadow")`
- `window.__crfRuleRuntimeSetMode("pilot", { formIds: "41_combined" })`
- `window.__crfRuleRuntimeSetMode("primary", { studyIds: "12" })`
- `window.__crfRuleRuntimeGetMode()`
- `window.__crfRuleRuntimeClearMode()`

## 2) Recommended Rollout Sequence

### Step A: Shadow only
- Mode: `shadow`
- Goal: parity visibility only (no behavior change).
- Capture reports:
  - `window.__crfRuleRuntimeLastParityReport`
  - `window.__crfRuleRuntimeDownloadLastParityReport()`

### Step B: Pilot apply (scoped)
- Mode: `pilot`
- Scope by form/study allowlists.
- Keep `applyValues` off initially.
- Monitor:
  - mismatch count
  - compare status (`pass/warn/fail`)
  - p95 runtime eval latency

### Step C: Primary (scoped)
- Mode: `primary`
- Enable `autoFallbackOnFail`.
- Use warn threshold + sample rate for mismatch triage.

## 3) Compare/Parity Operations

Get latest in-memory parity/perf report:
- `window.__crfRuleRuntimeLastParityReport`

Download JSON evidence for tickets:
- `window.__crfRuleRuntimeDownloadLastParityReport()`

Mismatch sampled records:
- `window.__crfRuleRuntimeGetMismatchSamples()`
- `window.__crfRuleRuntimeFlushMismatchSamples()`

## 4) Default Safe Guardrails

- Always begin with `shadow`.
- Use strict scope (`formIds`/`studyIds`) before `primary`.
- Keep `autoFallbackOnFail=1` in pilot and primary.
- Avoid enabling `applyValues` until compute parity is stable.

## 5) Exit Criteria to Expand Scope

Per form/study scope, require:
- parity mismatch count near zero (or accepted threshold),
- no critical blocking regressions in CRF save/submit,
- stable p95 eval latency for representative user paths.
