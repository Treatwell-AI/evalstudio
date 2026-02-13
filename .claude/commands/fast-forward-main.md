# Fast-Forward Main

Fast-forwards the `main` branch to match the current feature branch. Safely updates main without rewriting history.

## Usage

```
/fast-forward-main
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

3. **Fast-forward main to feature branch**

   ```bash
   git merge --ff-only $FEATURE_BRANCH
   ```

   This will fail cleanly if main has diverged (has commits not in the feature branch).

4. **Delete feature branch**

   ```bash
   git branch -d $FEATURE_BRANCH
   ```

5. **Confirm**

   Show the result: `main` fast-forwarded to `$FEATURE_BRANCH`. Branch `$FEATURE_BRANCH` deleted.

## Notes

- This is a local operation only (does not push)
- Safe: fails if main has diverged from the feature branch
- To push after: `git push origin main`