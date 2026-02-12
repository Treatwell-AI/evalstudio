# npm Publishing Setup

## Goal

Publish EvalStudio to npm so users can install and run it:

```bash
npm install -g @evalstudio/cli
evalstudio serve
```

## Package Strategy

### What gets published

Two packages ship to npm. The rest stay as internal workspace packages.

| Package | npm name | Published? | Why |
|---------|----------|------------|-----|
| Core | `@evalstudio/core` | **Yes** | Library — `npm install @evalstudio/core` for programmatic use |
| CLI | `@evalstudio/cli` | **Yes** | CLI binary — `npm install -g @evalstudio/cli` for the `evalstudio` command |
| API | `@evalstudio/api` | No (private) | Internal. Embedded in CLI via `evalstudio serve` |
| Web | `@evalstudio/web` | No (private) | Internal. Built assets ship inside CLI as static files |
| Docs | `@evalstudio/docs` | No (private) | Deployed as a website, not an npm package |

| Package dir | npm name | Published? |
|-------------|----------|------------|
| `packages/core` | `@evalstudio/core` | Yes |
| `packages/cli` | `@evalstudio/cli` | Yes |
| `packages/api` | `@evalstudio/api` | No (private) |
| `packages/web` | `@evalstudio/web` | No (private) |
| `packages/docs` | `@evalstudio/docs` | No (private) |

### Why two published packages

The core library (`@evalstudio/core`) and CLI (`@evalstudio/cli`) serve different audiences:

- **`@evalstudio/core`** — for developers who want the evaluation engine as a library: `import { createProject, executeEval } from "@evalstudio/core"`
- **`@evalstudio/cli`** — for users who want the CLI and web UI: `npm install -g @evalstudio/cli && evalstudio serve`

The CLI depends on core as a regular npm dependency — no bundling tricks needed. The CLI also depends on `@evalstudio/api` (private), which does need bundling (see below).

### Why not publish `@evalstudio/api`

With the `serve` command, the CLI embeds the API server. Nobody needs to install `@evalstudio/api` independently — there's no use case at v0.1 for mounting the Fastify server as a plugin in a separate app.

Publishing it would add a third package to version, release, and maintain for zero users. When someone asks for it, publish it then.

### How users install

```bash
# CLI: full stack (CLI + API + web UI + core)
npm install -g @evalstudio/cli
evalstudio serve

# Or via npx (no global install)
npx @evalstudio/cli serve

# Library: programmatic use only
npm install @evalstudio/core
```

```typescript
// Library usage — clean, no wrappers
import { createProject, listRuns, executeEval } from "@evalstudio/core";
```

The CLI `bin` field maps to the `evalstudio` command regardless of the package name:

```json
{
  "name": "@evalstudio/cli",
  "bin": {
    "evalstudio": "./dist/index.js"
  }
}
```

This is the same pattern as `@angular/cli` → `ng`, `@nestjs/cli` → `nest`.

## npm Org Setup

Create the `@evalstudio` organization on npmjs.com. This is free for public packages.

The org provides:

- **Namespace protection** — only org members can publish `@evalstudio/*`
- **Package grouping** — `npm search @evalstudio` shows all packages
- **Team permissions** — future collaborators can be granted publish access
- **Ownership of `evalstudio` unscoped name** — add the unscoped package to the org for unified management

## Package Configuration Changes

### `packages/core/package.json` (add publish metadata)

```jsonc
{
  "name": "@evalstudio/core",
  "version": "0.1.0",
  // ... existing fields unchanged ...
  "publishConfig": {
    "access": "public"
  },
  "keywords": ["eval", "evaluation", "testing", "chatbot", "ai", "llm"],
  "repository": {
    "type": "git",
    "url": "https://github.com/Treatwell-AI/evalstudio.git",
    "directory": "packages/core"
  }
}
```

### `packages/cli/package.json` (add publish metadata + bundleDependencies)

```jsonc
{
  "name": "@evalstudio/cli",
  "version": "0.1.0",
  // ... existing fields unchanged ...
  "publishConfig": {
    "access": "public"
  },
  "keywords": ["eval", "evaluation", "testing", "chatbot", "ai", "llm", "cli"],
  "repository": {
    "type": "git",
    "url": "https://github.com/anthropics/evalstudio.git",
    "directory": "packages/cli"
  },
  "dependencies": {
    "@evalstudio/core": "workspace:*",
    "@evalstudio/api": "workspace:*",
    "commander": "^13.0.0"
  },
  "bundleDependencies": ["@evalstudio/api"]
}
```

### `packages/api/package.json` (mark private)

```jsonc
{
  "name": "@evalstudio/api",
  "version": "0.1.0",
  "private": true,
  // ... rest unchanged ...
}
```

### `packages/web/package.json`

Already `"private": true`. No changes needed.

## The Bundling Problem (API only)

When `@evalstudio/cli` is published, pnpm replaces `workspace:*` with real versions:

- `"@evalstudio/core": "workspace:*"` → `"@evalstudio/core": "^0.1.0"` — **works**, core exists on npm
- `"@evalstudio/api": "workspace:*"` → `"@evalstudio/api": "^0.1.0"` — **fails**, API is private

### Solution: `bundleDependencies`

```json
{
  "bundleDependencies": ["@evalstudio/api"]
}
```

This tells npm/pnpm to include `@evalstudio/api` inside the published tarball rather than resolving it from the registry. The API code ships inside the CLI package as a nested dependency.

Only `@evalstudio/api` needs bundling. `@evalstudio/core` is a normal npm dependency that resolves from the registry.

### What the published tarball looks like

```
@evalstudio/cli-0.1.0.tgz
  package/
    dist/              ← CLI compiled code
    web-dist/          ← built web UI (static files)
    node_modules/
      @evalstudio/
        api/           ← bundled API package
    package.json
```

Core (`@evalstudio/core`) is NOT in the tarball — it's resolved from npm at install time, like any other dependency. This means core can be updated independently and deduplicated across the dependency tree.

## Version Management

### Strategy: Locked Versions

Both published packages share the same version number and are released together:

```
@evalstudio/core@0.1.0
@evalstudio/cli@0.1.0
```

When either package changes, both get a version bump and release. This keeps them in sync since the CLI depends on core.

### Tooling (optional at v0.1)

With only two published packages, version management is simple:

```bash
# Manual approach — bump both, tag, push
npm version patch --workspaces --no-git-tag-version
git tag v0.1.1
git push --tags
```

[Changesets](https://github.com/changesets/changesets) adds structured changelogs and release automation. Worth adopting, but not required for first publish:

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

Workflow:

1. Developer creates a changeset: `pnpm changeset`
2. Changesets accumulate in `.changeset/` directory across PRs
3. Release: `pnpm changeset version` bumps versions and updates changelogs
4. Publish: `pnpm changeset publish` publishes changed packages to npm

### `workspace:*` Protocol

pnpm's `workspace:*` protocol is automatically replaced during publish:

- In development: `"@evalstudio/core": "workspace:*"` resolves to the local package
- When published: pnpm replaces it with `"@evalstudio/core": "^0.1.0"` (the actual version)

This happens automatically — no manual version pinning needed.

## CI/CD Pipeline

### GitHub Actions: CI

`.github/workflows/ci.yml` — runs on every push and PR:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

### GitHub Actions: Publish

`.github/workflows/publish.yml` — publishes to npm on git tags:

```yaml
name: Publish
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm --filter @evalstudio/core publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
      - run: pnpm --filter @evalstudio/cli publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

If using changesets instead, replace the tag trigger with the changesets action:

```yaml
name: Publish
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Required Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `NPM_TOKEN` | GitHub repo secrets | npm automation token for publishing |
| `GITHUB_TOKEN` | Automatic | Creating release PRs and tags (changesets only) |

## Provenance

npm provenance links published packages to their source commit and build:

```yaml
env:
  NPM_CONFIG_PROVENANCE: true
```

This adds a verified badge on npmjs.com showing the package was built from a specific commit via GitHub Actions. Requires `id-token: write` permission.

## Pre-publish Checklist

### One-time setup (before first publish)

1. Create npm org `evalstudio` at npmjs.com/org/create
2. Create npm automation token and add as `NPM_TOKEN` repo secret
3. Mark API package as `"private": true`
4. Add `publishConfig.access: "public"` to `@evalstudio/cli`
5. Add `bundleDependencies: ["@evalstudio/api"]` to `@evalstudio/cli`
6. Add `repository` and `keywords` to both published packages
7. Add CI and publish GitHub Actions workflows
8. Verify builds work: `pnpm clean && pnpm build`
9. Dry run: `cd packages/cli && pnpm pack` — inspect the tarball to verify API is bundled and core is not

### Per-release workflow

1. Bump versions in both packages (manually or via `pnpm changeset`)
2. Push tag (`git tag v0.1.0 && git push --tags`) or merge version PR
3. CI publishes both packages to npm

## Implementation Order

1. **Create npm org** — manual step on npmjs.com
2. **Mark API as private** — add `"private": true` to `@evalstudio/api`
3. **Add `bundleDependencies`** — so `@evalstudio/api` ships inside CLI tarball
4. **Add package metadata** — `publishConfig.access: "public"`, `repository`, `keywords`
5. **Add CI workflow** — GitHub Actions for validation
6. **Add publish workflow** — GitHub Actions for automated releases
7. **First publish** — bump version, push tag, npm publish

Steps 2-4 are a single small PR. Steps 5-6 are a second PR. Step 7 is the actual first release.
