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

1. **Read current version** from `packages/core/package.json`

2. **Calculate new version**:
   - `patch`: increment Z (0.0.1 → 0.0.2)
   - `minor`: increment Y, reset Z (0.0.1 → 0.1.0)
   - `major`: increment X, reset Y and Z (0.0.1 → 1.0.0)
   - Explicit version: use as-is (validate semver format)

3. **Update all package.json files using pnpm**:
   ```bash
   # Use pnpm recursive exec to run npm version in all packages
   pnpm -r exec npm version <version> --no-git-tag-version
   ```
   This updates:
   - `packages/core/package.json` (@evalstudio/core)
   - `packages/cli/package.json` (@evalstudio/cli)
   - `packages/api/package.json` (@evalstudio/api)
   - `packages/web/package.json` (@evalstudio/web)
   - `packages/docs/package.json` (@evalstudio/docs)

4. **Commit the version bump**:
   ```bash
   git add packages/*/package.json
   git commit -m "chore: bump version to X.Y.Z

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

5. **Create git tag**:
   ```bash
   git tag vX.Y.Z
   ```

6. **Show summary**:
   ```
   Version bumped: 0.0.1 → 0.1.0

   Updated packages:
     ✓ @evalstudio/core
     ✓ @evalstudio/cli
     ✓ @evalstudio/api
     ✓ @evalstudio/web
     ✓ @evalstudio/docs

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
