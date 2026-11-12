# SnappsHub — Branch workflow

This repository uses separate refs for production tracking, verification work, and recovery.

## Branch roles

| Branch | Purpose | Change policy |
|---|---|---|
| `main` | Current GitHub Pages production source | Do not change without explicit release approval |
| `live` | Reference snapshot of `main` created on 2026-11-12 | Keep aligned with approved production state; this branch name alone does not configure deployment |
| `check` | Active integration and QA branch for upcoming work | New website and admin-panel changes go here first |
| `backup/full-project-2026-11-12` | Point-in-time full-repository recovery snapshot | Keep immutable; do not develop on this branch |
| `feature/device-category-navigation` | Earlier device/category implementation branch | Retain as historical feature branch; continue current integration on `check` |

## Verified baseline (2026-11-12)

- `main` and `live` point to the same baseline: `35fe9b3dcccbaeb1edecd36666278a6f3d8f1bac`.
- `check`, `backup/full-project-2026-11-12`, and `feature/device-category-navigation` point to the same baseline: `ba312a51882e3b533fc7194fa00d8aebe9c1c304`.
- The check baseline contains the two device/category navigation commits on top of `main`.
- The backup is a complete Git tree snapshot, not a separate empty folder or ZIP.
- No branch is merged into `main` or deployed to production without explicit approval.

## Release flow

1. Implement changes on `check`.
2. Run syntax, link, responsive, navigation, and security checks; record known blockers.
3. Keep the backup branch unchanged.
4. Present the check branch / preview evidence for review.
5. Only after explicit approval, prepare a pull request from `check` to `main` and release.
6. Update `live` only as part of an approved release; do not treat it as production automatically.

## Important deployment note

Git branch names do not determine the hosting target by themselves. The repository's actual GitHub Pages / Vercel deployment configuration must be checked before claiming that `live` is deployed. At this baseline, `main` is the canonical website source and `live` is only its reference copy.
