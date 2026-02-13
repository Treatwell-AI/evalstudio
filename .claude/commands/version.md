# Version Management

Bump the version across all packages in the monorepo.

## Usage

```
/version patch       # 0.0.1 → 0.0.2
/version minor       # 0.0.1 → 0.1.0
/version major       # 0.0.1 → 1.0.0
/version 1.2.3       # Set explicit version
/version             # Show current version
```

## Steps

### Show Current Version (no argument)

1. Read the core `package.json` version
2. Display: `Current version: X.Y.Z`

### Bump Version

1. **Read current version** from `packages/core/package.json` (for the summary display)

2. **Update all package.json files using pnpm**:
   ```bash
   # npm version handles patch/minor/major calculation natively
   pnpm -r exec npm version <argument> --no-git-tag-version
   ```
   Where `<argument>` is passed through directly: `patch`, `minor`, `major`, or an explicit semver like `1.2.3`.
   This updates:
   - `packages/core/package.json` (@evalstudio/core)
   - `packages/cli/package.json` (@evalstudio/cli)
   - `packages/api/package.json` (@evalstudio/api)
   - `packages/web/package.json` (@evalstudio/web)
   - `packages/docs/package.json` (@evalstudio/docs)

3. **Read new version** back from `packages/core/package.json` (needed for commit message and tag)

4. **Promote changelog `[Unreleased]` to new version**:
   - Read `CHANGELOG.md`
   - If there are entries under `## [Unreleased]` (any `### Added`, `### Changed`, etc. content before the next `## [` heading or end of file), rename that heading to `## [X.Y.Z] - YYYY-MM-DD` (today's date) and add a fresh empty `## [Unreleased]` section above it
   - If there are no entries under `[Unreleased]` (just the heading with nothing below it, or only blank lines), skip this step
   - Stage the updated file: `git add CHANGELOG.md`

5. **Commit the version bump**:
   ```bash
   git add packages/*/package.json
   git commit -m "chore: bump version to X.Y.Z

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

6. **Create git tag**:
   ```bash
   git tag vX.Y.Z
   ```

7. **Show summary**:
   ```
   Version bumped: 0.0.1 → 0.1.0

   Updated packages:
     ✓ @evalstudio/core
     ✓ @evalstudio/cli
     ✓ @evalstudio/api
     ✓ @evalstudio/web
     ✓ @evalstudio/docs

   Changelog:
     ✓ Promoted [Unreleased] → [0.1.0] - 2026-02-13

   Git:
     ✓ Committed: chore: bump version to 0.1.0
     ✓ Tagged: v0.1.0

   To push: git push && git push --tags
   ```

## Notes

- All packages maintain the same version number
- Automatically commits and tags (local only)
- Does not push to remote (manual step)
- Validates semver format for explicit versions
