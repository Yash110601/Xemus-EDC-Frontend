# YP Intelligence — Frontend Module Guide

YP Intelligence is the governed AI layer for Xemus EDC. All modules follow **suggest-only** workflow: AI proposes, humans confirm, every action is audit-logged.

## Modules

| Module | Constant | Study flag | Primary UI |
|--------|----------|------------|------------|
| Capture | `capture` | `IsAiEntryEnabled` | AI-based eCRF entry, `AiFillChoiceModal` review |
| Verify | `verify` | `IsAiRsdvVerifyEnabled` | RSDV document annotator source match |
| Studio | `studio` | `IsAiCrfStudioEnabled` | CRF Studio extraction passes |
| Guard | `guard` | `IsAiQualityHintsEnabled` | Pre-submit quality hints, MedDRA/WHO-DD assist |
| Insight | `insight` | `IsAiInsightEnabled` | CRA copilot summary, study assistant chat |
| Consent | `consent` | `IsAiConsentAssistEnabled` | eCONSENT question generation |

Master toggle: `IsXemusIntelligenceEnabled` — when off, all sub-flags are ignored.

## Hub

**YP Intelligence** (`/intelligence`) — sidebar landing page. Shows per-study module on/off status and links into Capture, Verify, Studio, Guard, Insight, Consent, plus AI Oversight Report.

## Configuration

**Study Settings** (`/study-management/study-settings`) — YP Intelligence section with master + sub-toggles.

**Read flags in UI:**

```js
import { useStudyAiSettings } from "@/lib/intelligence/useStudyAiSettings"

const { isAiEntryEnabled, isAiRsdvVerifyEnabled } = useStudyAiSettings()
```

Or from cached settings:

```js
import { pickStudyAiSettings } from "@/lib/utils/studySettingsRead"
```

## Shared library

- `lib/intelligence/xemusIntelligence.js` — module constants, confidence helpers, capture suggestion builder
- `lib/intelligence/useStudyAiSettings.js` — React hooks for study-scoped flags
- `lib/services/xemusAi.service.js` — API client for `XemusAiController` + RSDV suggest endpoints

## Reusable components

- `AiSuggestionBanner` — accept/reject with confidence and match status
- `AiQualityHintsPanel` — pre-submit hints (acknowledge or dismiss)
- `StudyAssistantPanel` — floating RAG chat in eCRF and RSDV
- `AiMonitoringSummaryCard` — CRA weekly summary on dashboard

## API endpoints (backend)

Configured in `lib/api/config.js` under `XEMUS_AI`:

- `POST /RsdvReview/SuggestSourceMatch`
- `POST /RsdvReview/SuggestQuery`
- `POST /XemusAi/AnalyzeCrfQuality`
- `POST /XemusAi/SuggestCoding`
- `POST /XemusAi/GenerateMonitoringSummary`
- `POST /XemusAi/StudyAssistant`
- `POST /XemusAi/GenerateConsentQuestions`
- `POST /XemusAi/RecordAcceptance`
- `GET /XemusAi/OversightReport`

Optional Next.js proxies: `/api/ai/rsdv-match`, `/api/ai/query-draft`, `/api/ai/studio-extract`.

## Reports

**AI Oversight Report** — `/reports/ai-oversight-report`  
Suggestion accept/reject rates by module, user, and site. Requires backend `AiSuggestionLogs` table.

## GxP rules (non-negotiable)

1. AI never auto-submits CRFs, queries, or SDV marks
2. Log accept/reject via `xemusAiService.recordAcceptance`
3. Gate UI and API calls on study settings flags
4. PHI inference via authenticated backend or existing `/api/ai/*` proxies

## Adding a new AI feature

1. Add study setting flag (backend + `pickIs*` in `studySettingsRead.js`)
2. Extend `pickStudyAiSettings` and study settings UI
3. Add endpoint to `XEMUS_AI` in config + method on `xemusAi.service.js`
4. Gate UI with `useStudyAiSettings` and use `AiSuggestionBanner` where appropriate
5. Log suggestions to oversight report via `RecordAcceptance`
