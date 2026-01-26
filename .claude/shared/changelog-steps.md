# Changelog Generation Steps

## 1. Analyze Changes

Run these commands to understand what changed:

```bash
git diff --cached --stat
git log main..HEAD --oneline
git diff main --stat
```

## 2. Categorize Changes

Identify the type(s) of change:
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Fixed** - Bug fixes
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Security** - Security fixes

## 3. Generate Entry

Create entry following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added
- Description of new feature (#issue-number)

### Changed
- Description of changes

### Fixed
- Description of bug fixes
```

## 4. Update CHANGELOG.md

1. Read existing `CHANGELOG.md` (create if doesn't exist)
2. Insert new entry under `## [Unreleased]` section
3. If no `[Unreleased]` section, add one at the top after header

## 5. Confirm

- Show the proposed entry to user
- Ask for confirmation before writing
- Allow edits if needed
