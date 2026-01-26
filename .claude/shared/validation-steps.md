# Validation Steps

Execute these steps in sequence and report results:

## 1. Type Checking

```bash
yarn typecheck
```

- If errors: list them and offer to help fix
- If pass: continue

## 2. Linting

```bash
yarn lint
```

- If errors: offer `yarn lint --fix` for auto-fixable issues
- If pass: continue

## 3. Unit Tests

```bash
yarn test
```

- Report: X passed, Y failed
- If failures: show failing test names and offer to help debug

## 4. Build

```bash
yarn build
```

- If errors: show build errors
- If pass: all packages built successfully

## 5. Summary

Output format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Validation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TypeScript:  ✓ Pass / ✗ X errors
Linting:     ✓ Pass / ✗ X errors
Tests:       ✓ X passed / ✗ Y failed
Build:       ✓ Pass / ✗ Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to commit: Yes/No
```
