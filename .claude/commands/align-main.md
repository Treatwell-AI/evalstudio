# Align Main Branch

Resets the `main` branch to match the current feature branch. Useful for keeping main in sync during development.

## Usage

```
/align-main
```

## Steps

1. **Get current branch**
   ```bash
   git branch --show-current
   ```
   Store as `$FEATURE_BRANCH`. Abort if already on `main`.

2. **Checkout main**
   ```bash
   git checkout main
   ```

3. **Reset main to feature branch**
   ```bash
   git reset --hard $FEATURE_BRANCH
   ```

4. **Return to feature branch**
   ```bash
   git checkout $FEATURE_BRANCH
   ```

5. **Confirm**
   Show the result: `main` is now aligned with `$FEATURE_BRANCH`.

## Notes

- This is a local operation only (does not push)
- Use with caution: this rewrites `main` history locally
- To push after aligning: `git push origin main --force`
