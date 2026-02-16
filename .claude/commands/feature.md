# Feature Workflow

Comprehensive command for implementing features from start to finish.

## Usage

```
/feature                    # Start new feature (interactive)
/feature <name>             # Start new feature with name
/feature complete           # Full workflow: validate + changelog + docs + commit
/feature status             # Show current feature progress
```

---

## `/feature` or `/feature <name>` - Start New Feature

### 0. Pre-flight Checks

**REQUIRED** — run these checks before anything else. If any fail, **stop immediately** and report the error to the user.

1. **No active feature**: Check if `.claude/current-feature.json` exists. If it does, **stop** with error:
   > Error: Feature "<name>" is already in progress. Run `/feature complete` to finish it or delete `.claude/current-feature.json` to abandon it.

2. **On main branch**: Run `git branch --show-current`. If the current branch is not `main`, **stop** with error:
   > Error: Must be on `main` branch to start a new feature. Current branch: `<branch>`. Switch to main first with `git checkout main`.

3. **Clean working tree**: Run `git status --porcelain`. If there are uncommitted changes, **stop** with error:
   > Error: Working tree has uncommitted changes. Commit or stash them before starting a new feature.

### 1. Gather Info

- **Name** (kebab-case): ask if not provided
- **Description**: brief one-liner
- **Packages** (multi-select):
  - [ ] `@evalstudio/core`
  - [ ] `@evalstudio/cli`
  - [ ] `@evalstudio/api`
  - [ ] `@evalstudio/web`
  - [ ] All of the above packages

### 2. Setup

```bash
git checkout -b feat/<feature-name>
```

### 3. Create Tracking File

Write `.claude/current-feature.json`:

```json
{
  "name": "feature-name",
  "description": "Brief description",
  "issue": "#123",
  "packages": ["@evalstudio/core", "@evalstudio/cli"],
  "startedAt": "2026-01-26T10:00:00Z",
  "checklist": {
    "specs": false,
    "core": false,
    "cli": false,
    "api": false,
    "web": false,
    "tests": false,
    "docs": false,
    "changelog": false
  }
}
```

### 4. Read Specs for Context

**REQUIRED**: Before implementing, read the specification files to understand project patterns:

- `specs/SPEC.md` - Product requirements, user workflows, UI structure, glossary
- `specs/ARCHITECTURE.md` - System components, interfaces, technology stack

These files define the project's conventions that must be followed during implementation.

### 5. Guide Implementation

Use TodoWrite to track progress through affected packages.
Reference `.claude/shared/package-guidance.md` for package-specific implementation patterns.

---

## `/feature complete` - Full Completion

**IMPORTANT**: This command must be explicitly invoked by the user. Do NOT run this automatically after implementation - wait for the user to run `/feature complete` when they are ready to finalize.

### Pre-flight Checks

**REQUIRED** — run these checks before anything else. If any fail, **stop immediately**.

1. **Active feature**: Verify `.claude/current-feature.json` exists. If not, **stop** with error:
   > Error: No active feature. Run `/feature` to start one first.

2. **On feature branch**: Run `git branch --show-current`. Verify it matches `feat/<name>` from the tracking file. If not, **stop** with error:
   > Error: Expected branch `feat/<name>`, but on `<current>`. Switch to the feature branch first.

### Workflow

1. **Validate**: Execute `.claude/shared/validation-steps.md`
   - Stop if validation fails

2. **Changelog**: Execute `.claude/shared/changelog-steps.md`
   - Use feature context for pre-filled entry

3. **Docs**: Execute `.claude/shared/docs-steps.md`
   - Create/update documentation for affected packages
   - Focus on packages marked in feature config

4. **Code Snippets**: Update example code if APIs/interfaces changed
   - Check if the feature modified any TypeScript interfaces or API endpoints
   - If yes, search for code snippet components (e.g., `EvalCodeSnippets.tsx`, `PersonaCodeSnippets.tsx`, `ScenarioCodeSnippets.tsx`)
   - Update any hardcoded API calls, interface usage, or examples to match new signatures
   - Verify snippets still represent accurate usage patterns
   - Common locations: `packages/web/src/components/*CodeSnippets.tsx`

5. **User Stories**: Update `specs/USER-STORIES.md`
   - Review the feature name, description, and changes made
   - Search for related user stories in the file
   - If a matching user story exists and is not done, mark it as done: `[ ]` → `[x]`
   - If no matching user story exists, create a new one in the appropriate section and mark it as done
   - Format: `[x] As a user, I want to <feature capability> so that <benefit>`

6. **Stage all changes**: Stage everything including cleanup

   ```bash
   git add .
   git commit -m "feat(<scope>): final changes"
   ```

7. **Cleanup**: Delete `.claude/current-feature.json`, stage the deletion

   ```bash
   rm .claude/current-feature.json
   git add .claude/current-feature.json
   git commit -m "chore: remove feature tracking file"
   ```

8. **Squash-merge into main**: Merge all feature commits into a single commit on main and delete the branch

   ```bash
   git checkout main
   git merge --squash feat/<feature-name>
   git commit -m "feat(<scope>): <description>

   <body from feature description>

   Closes #<issue>

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git branch -D feat/<feature-name>
   ```

9. **Next Steps**: Suggest `git push origin main`

---

## `/feature status` - Show Progress

0. **Pre-flight**: Verify `.claude/current-feature.json` exists. If not, **stop** with:
   > No active feature. Run `/feature` to start one.

Read `.claude/current-feature.json` and display:

```
Feature: add-webhooks
Branch: feat/add-webhooks
Started: 2 hours ago
Issue: #123

Progress:
  ✓ Specs updated
  ✓ Core implementation
  ✓ CLI changes
  ○ API changes (skipped - not in packages)
  ○ Web changes (skipped - not in packages)
  ✓ Tests passing
  ○ Docs
  ○ Changelog

Next: Run /feature complete
```

---

## Notes

- Use standalone `/validate`, `/changelog`, `/docs` for ad-hoc use outside a feature workflow
- `/feature complete` runs validation, changelog, and docs with feature context automatically
