# PR EDC Frontend — Documentation

Single entry point for human-readable project docs. **New docs belong here** — not under `components/` or `lib/`.

## New developer

→ [Developer setup](onboarding/DEV_SETUP.md)

## Release & deploy

→ [Git branch flow](release/GIT_BRANCH_FLOW.md)  
→ [Deployment & environment](release/DEPLOYMENT_ENV.md)

## Engineering

→ [Architecture](engineering/ARCHITECTURE.md)  
→ [API services](engineering/API_SERVICES.md)

## Domain guides

### CRF Designer

→ [API payload structure](domains/crf-designer/API_PAYLOAD_STRUCTURE.md)  
→ [CRF data entry guide](domains/crf-designer/CRF_DATA_ENTRY_GUIDE.md)  
→ [Data entry database](domains/crf-designer/DATA_ENTRY_DATABASE.md)  
→ [Demo guide](domains/crf-designer/DEMO_GUIDE.md)  
→ [Optimization guide](domains/crf-designer/OPTIMIZATION_GUIDE.md)  
→ [Rules guide](domains/crf-designer/RULES_GUIDE.md)  
→ [Rule guideline book](domains/crf-designer/RULE_GUIDELINE_BOOK.md)

### Rule engine

→ [Rule engine overview](domains/rule-engine/README.md)  
→ [Phase runbook](domains/rule-engine/PHASE_RUNBOOK.md)

## AI / Cursor rules

→ `.cursor/rules/` — agent behavior only; not day-to-day reading

## Archive

→ [Historical docs](archive/README.md) — planning and superseded designs; do not implement from these

## Team rules

1. Add new docs under `docs/` and link them from this file.
2. Code folders may have a short `README.md` pointer only — no full guides in `components/` or `lib/`.
3. When a feature ships, move planning docs to `docs/archive/`.
