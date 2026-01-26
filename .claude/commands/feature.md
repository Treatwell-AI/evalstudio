# Feature Workflow

Comprehensive command for implementing features from start to finish.

## Usage

```
/feature                    # Start new feature (interactive)
/feature <name>             # Start new feature with name
/feature validate           # Run validation on current feature
/feature changelog          # Generate changelog for current feature
/feature docs               # Update docs for current feature
/feature complete           # Full workflow: validate + changelog + docs + commit
/feature status             # Show current feature progress
```

---

## `/feature` or `/feature <name>` - Start New Feature

### 1. Gather Info

- **Name** (kebab-case): ask if not provided
- **Description**: brief one-liner
- **Packages** (multi-select):
  - [ ] `evalstudio` (core)
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
  "packages": ["evalstudio", "@evalstudio/cli"],
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

## `/feature validate` - Run Validation

1. Read `.claude/current-feature.json` for context
2. Execute steps from `.claude/shared/validation-steps.md`
3. Prefix output with feature name
4. Update checklist if tests pass

---

## `/feature changelog` - Generate Changelog

1. Read `.claude/current-feature.json` for context (use description, issue)
2. Execute steps from `.claude/shared/changelog-steps.md`
3. Pre-fill entry with feature description and issue reference
4. Update checklist

---

## `/feature docs` - Update Documentation

1. Read `.claude/current-feature.json` for context (affected packages)
2. Execute steps from `.claude/shared/docs-steps.md`
3. Focus on packages marked in feature config
4. Update checklist

---

## `/feature complete` - Full Completion

**IMPORTANT**: This command must be explicitly invoked by the user. Do NOT run this automatically after implementation - wait for the user to run `/feature complete` when they are ready to finalize.

Run the complete workflow:

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

6. **Commit**: Stage and commit

   ```bash
   git add .
   git commit -m "feat(<scope>): <description>

   <body from feature description>

   Closes #<issue>

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

7. **Cleanup**: Delete `.claude/current-feature.json`

8. **Next Steps**: Suggest `git push -u origin feat/<name>` and PR creation

---

## `/feature status` - Show Progress

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

- If no `.claude/current-feature.json` exists when running subcommands, prompt to start a feature first or suggest standalone commands
- Standalone `/validate`, `/changelog`, `/docs` work without feature context
