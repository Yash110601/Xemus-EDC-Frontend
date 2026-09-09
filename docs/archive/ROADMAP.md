# eCRF Rule Engine Redesign Roadmap

## Goal

Build a scalable, deterministic, observable rule platform that can handle
large rule sets with safe incremental execution and low regression risk.

## Phase 1 (Implemented in this branch)

- Canonical contracts for rules and runtime patches.
- Compiler scaffold from existing rules to canonical objects.
- Dependency graph index for impacted-rule selection.
- Runtime facade with trace output and validation patch envelope.
- Shadow-mode hook in data-entry page (feature-flagged via localStorage):
  - key: `crfRuleRuntimeShadow`
  - value: `"1"`

## Phase 2 (In progress)

- Action reducer for:
  - visibility
  - readonly
  - required/required message
  - date bounds
  - compute (callback-driven evaluation)
- Conflict resolution policy:
  - priority
  - deterministic tie-break
  - per-property merge strategy
- Phase 2.5:
  - pilot patch application via feature flags
  - mismatch diagnostics against legacy effective properties
  - compute callback wired in shadow runtime

## Phase 3

- Replace duplicated date-dependency logic with runtime patches.
- Row-scoped table evaluation planner.
- Runtime worker execution path for heavy scenarios.

## Phase 4

- Dual-run parity checker:
  - compare legacy output with new runtime output
  - emit mismatch diagnostics
- Rollout by feature flag per study/form.
- Status: started (compare status, rollout gating, mismatch sampling implemented)

## Phase 5

- Promote new runtime as primary engine.
- Remove legacy rule side effects from UI layers.
- Keep adapter layer for backward-compatible rule schemas.
- Status: prep + execution controls implemented (mode switch helper available)

## Non-functional acceptance targets

- p95 incremental eval under 30 ms for typical form edits
- deterministic output for repeated same input
- full traceability for each mutated field (`ruleId`, source values, action)
