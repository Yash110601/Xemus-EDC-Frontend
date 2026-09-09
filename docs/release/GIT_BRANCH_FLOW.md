# Git Safe Release Flow (No Code Loss)

This project uses 4 main branches:

- `jainish` (feature/dev work)
- `master` (stable integration)
- `UAT` (uat deployment source)
- `PROD` (production deployment source)

## Mandatory Promotion Path

Do not skip branch levels.

1. Dev work: `jainish` -> `master` (PR)
2. UAT deploy: `master` -> `UAT` (PR)
3. PROD deploy: `UAT` -> `PROD` (PR)

## Never Do

- Do not create PR from `jainish` directly to `UAT` or `PROD`.
- Do not force push (`--force`) on shared branches.
- Do not use destructive reset for shared history.
- Do not merge with unresolved conflicts.

## No-Loss Commit/Push Checklist (Every Time)

1. Fetch latest refs:
   - `git fetch --all --prune`
2. Check current branch:
   - `git branch --show-current`
3. Verify changed files:
   - `git status`
   - `git diff`
4. Stage only intended files:
   - `git add <file1> <file2> ...`
5. Recheck staged content:
   - `git diff --staged`
6. Commit with clear message:
   - `git commit -m "<type>: <why change is needed>"`
7. Push safely:
   - `git push origin <branch>`
8. Open PR to next branch in flow.
9. Before merging PR, verify:
   - CI/checks pass
   - reviewer approved
   - diff matches expected scope

## Pre-Merge Verification Commands

Use these before merging to ensure no line loss:

- Compare branch with target:
  - `git diff origin/<target>...HEAD`
- See commit list to be merged:
  - `git log --oneline origin/<target>..HEAD`

## Release Examples

### UAT Release

1. Merge `jainish` -> `master`
2. After merge, create PR `master` -> `UAT`
3. Merge PR and deploy from `UAT`

### PROD Release

1. Ensure `UAT` contains approved release
2. Create PR `UAT` -> `PROD`
3. Merge PR and deploy from `PROD`

## Team Rule

If any step is unclear, stop and verify before push/merge.
No fast shortcuts on release branches.
