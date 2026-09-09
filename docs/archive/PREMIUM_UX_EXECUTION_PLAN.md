# Premium UX + Perf Execution Plan

This plan targets "static-form feel" for dynamic eCRF rules while preserving deterministic behavior.

## North-Star Targets

- Keystroke-to-stable-UI: p95 <= 16ms on representative forms.
- Hot rule evaluation pass: p95 <= 8ms.
- Warm pass (debounced/background): p95 <= 14ms.
- Cold pass (idle/submit-heavy): p95 <= 30ms in idle; <= 20ms on submit path.
- No main-thread long tasks (>50ms) during common data-entry.

## Phase 1: Benchmark Proof (in progress)

Goal: establish reproducible perf evidence for 10k/50k/100k rule-like workloads.

Deliverables:
- `scripts/rule-runtime-benchmark-matrix.cjs` for matrix runs.
- CI command to run baseline + matrix + tier assertions.
- Published threshold policy for pass/fail in CI.

## Phase 2: Worker Offload Coverage

Goal: move warm/cold computation away from main thread.

Implementation:
- Expand worker usage for runtime warm/cold evaluation envelope.
- Keep hot pass local for immediate UX.
- Add cancellation token/versioning to drop stale worker responses.

Acceptance:
- No stale patch application.
- Worker queue backlog telemetry exposed.

## Phase 3: Render-Batch Strategy

Goal: reduce re-render churn when many patches land.

Implementation:
- Group patch applications into micro-batches.
- Prefer structural sharing and map-level diff checks.
- Defer non-visual updates to post-frame where safe.

Acceptance:
- Reduced render counts on stress CRFs.
- p95 render commit time improved vs baseline.

Status:
- In progress: transition-based runtime apply path added.
- In progress: stage SLO render probe active.

## Phase 4: Heavy Form Virtualization

Goal: keep DOM and React work bounded.

Implementation:
- Virtualize long section/control lists in data-entry flows with many controls.
- Keep validation, query badges, and dirty-state visible for virtualized rows.

Acceptance:
- Memory and FPS stability on large forms.
- No regressions in save/submit/status workflows.

Status:
- In progress: progressive render-window fallback for very large sections.

## Phase 5: Prefetch on Intent

Goal: prepare likely-next rule context before user action.

Implementation:
- Use focus/hover/row-add triggers for predictive precompute.
- Cache short-lived precomputed dependency slices.
- Drop cache on conflicting edits or form context switch.

Acceptance:
- Lower p95 on first-interaction for predicted fields.
- Zero behavior divergence from non-prefetch execution.

Status:
- In progress: runtime likely-next cache exposure + browser helpers.

## Phase 6: Production Gating & Rollout

Goal: safe expansion to wider studies.

Implementation:
- Scope by study/form allowlists.
- Keep auto-fallback on parity fail.
- Define release gates using mismatch rates + p95 budgets + error budget.

Acceptance:
- Shadow -> pilot -> primary progression with audit artifacts.
- Regression triage runbook updates after each scope expansion.

Status:
- In progress: strict telemetry gates with per-group report artifacts.

## Weekly Execution Cadence

1. Add one performance capability.
2. Capture matrix evidence and compare against previous baseline.
3. Expand scope only if parity + perf gates pass.
4. Keep rollback switch ready via runtime mode helpers.
