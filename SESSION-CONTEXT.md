# Session Context — Jamf MCP Server v2.0 Implementation

## Status: NOT STARTED — Awaiting user go-ahead

## What Happened
- User provided 4 plan documents (stored in iCloud Downloads):
  - `PLAN-master-implementation.md` — Master plan covering all 3 workstreams
  - `PLAN-consolidate-compat-tools.md` — Workstream A details
  - `PLAN-new-workflow-prompts.md` — Workstream B details (full prompt text for all 7 prompts)
  - `PLAN-api-gap-analysis.md` — Workstream C details (gap analysis, new tool specs, new workflows)
- All 4 plans were read and reviewed. No code changes have been made yet.

## Plan Summary

### Workstream A: Consolidate Compat Tools (Step 1)
- Delete `src/tools/index.ts` (basic, 31 tools — dead code)
- Rename `src/tools/index-compat.ts` → `src/tools/index.ts` (56 tools)
- Delete `src/resources/index.ts` (basic — dead code)
- Rename `src/resources/index-compat.ts` → `src/resources/index.ts`
- Update imports in 4 entry files + 6 test files
- Verify: build, test, grep for zero remaining `index-compat` references

### Workstream B: 7 New Workflow Prompts (Step 2)
- Append to `src/prompts/index.ts`
- Prompts: security-audit, new-device-onboarding, device-offboarding, software-update-review, fleet-health-dashboard, investigate-device-issue, policy-rollout
- Full prompt text is in `PLAN-new-workflow-prompts.md`

### Workstream C: New API Tools + Resources + Prompts (Steps 3-8)
- **Phase 1 (Step 3):** 11 tools — Computer History (3), Computer MDM Commands (1), Command Flush (1), Buildings (2), Departments (2), Categories (2)
- **Phase 2 (Step 4):** 11 tools — LAPS (3), Patch Management (4), Extension Attributes (4)
- **Phase 3 (Step 5):** 10 tools — Managed Software Updates (3), Computer Prestages (3), Network Segments (2), Mobile Prestages (2)
- **Phase 4 (Step 6):** 12 tools — Accounts (3), Users (3), App Installers (2), Restricted Software (2), Webhooks (2)
- **Step 7:** 6 new resources (patch-compliance, encryption-status, extension-attributes, prestages, failed-mdm-commands, laps-audit)
- **Step 8:** 7 more API-driven workflow prompts (laps-password-retrieval, os-update-deployment, patch-compliance-review, device-history-audit, extension-attribute-deployment, network-segment-audit, enrollment-prestage-review)

### Step 9: Final Verification
- Build, test, inspector check for 100 tools / 12 resources / 19 prompts

## Target Counts
| Item       | Current | Target |
|------------|---------|--------|
| Tools      | 56      | 100    |
| Resources  | 6       | 12     |
| Prompts    | 5       | 19     |

## Files That Will Be Modified
- `src/jamf-client-hybrid.ts` — ~30 new client methods
- `src/tools/index-compat.ts` → `src/tools/index.ts` — consolidate + new tools
- `src/resources/index-compat.ts` → `src/resources/index.ts` — consolidate + new resources
- `src/prompts/index.ts` — 14 new prompts total
- `src/index.ts` — update imports
- `src/index-enhanced.ts` — update imports
- `src/index-with-advanced-search.ts` — update imports
- `src/index-advanced-search.ts` — update imports
- 6 test files — update imports

## Plan Source Files (for full details)
- `/Users/dbanks/Library/Mobile Documents/com~apple~CloudDocs/Downloads/PLAN-master-implementation.md`
- `/Users/dbanks/Library/Mobile Documents/com~apple~CloudDocs/Downloads/PLAN-consolidate-compat-tools.md`
- `/Users/dbanks/Library/Mobile Documents/com~apple~CloudDocs/Downloads/PLAN-new-workflow-prompts.md`
- `/Users/dbanks/Library/Mobile Documents/com~apple~CloudDocs/Downloads/PLAN-api-gap-analysis.md`

## Next Action
Start with **Workstream A: Consolidate compat tools** (rename files, update imports, build + test).
