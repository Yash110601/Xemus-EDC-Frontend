# Rule Engine Implementation Status

## Completed

- Phase 1 foundation:
  - canonical contracts
  - compiler scaffold
  - dependency graph
  - runtime facade
- Phase 2 + 2.5:
  - deterministic reducer
  - conflict policy
  - compute callback support
  - pilot patch application path
  - legacy vs runtime mismatch diagnostics
- Phase 3 + 3.1:
  - parity report utility
  - perf tracker utility
  - downloadable JSON report helper
- Phase 4.2 + 5 prep and controls:
  - rollout gate with form/study scopes
  - compare status policy
  - auto fallback on compare fail
  - mismatch sampler
  - runtime mode manager (off/shadow/pilot/primary)
- Phase 2 hardening and telemetry gates:
  - tier scheduler + warm/cold best-effort passes
  - stage SLO budgets (evaluate/apply/render)
  - strict CI stage gates with real telemetry input
  - telemetry merge pipeline with per study/form breakdown
  - machine-readable stage gate report artifacts
- Phase 3/4/5 UX path foundations:
  - transition-based runtime patch apply path (reduced blocking updates)
  - heavy-section progressive render window for very large control sets
  - predictive prefetch cache exposure for likely-next fields

## Pending (deliberate, high-impact)

- Move legacy rule action execution completely behind runtime reducer.
- Replace duplicate date/table side-effect paths with runtime-first path.
- Add backend uploader for mismatch samples (currently local stub).
- Add automated parity regression suite for selected CRFs.
- Upgrade progressive render window to true scroll virtualization with stable row measurement.
- Add server-side aggregation pipeline for stage telemetry and release dashboards.

## Recommended Next Engineering Slice

1. Choose 1-2 pilot forms.
2. Run shadow for a full QA cycle and collect reports.
3. Enable pilot in scoped forms with auto fallback.
4. Track mismatch trend and performance trend.
5. Promote those forms to primary mode once stable.
