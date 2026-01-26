# Documentation Update Steps

## 1. Identify Documentation Needs

Ask what type of documentation is needed:
- [ ] API reference (new endpoints, methods)
- [ ] CLI reference (new commands, flags)
- [ ] User guide (how-to, tutorials)
- [ ] Configuration (new options, settings)

## 2. Locate Existing Docs

```bash
ls packages/docs/docs/
```

Show structure and help find the right file.

## 3. Generate Documentation

**For API endpoints:**
```markdown
## POST /api/evals/:id/webhook

Configure webhook notification for an eval.

### Request Body
| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Webhook URL |

### Response
```json
{ "success": true }
```
```

**For CLI commands:**
```markdown
## evalstudio webhook

Configure webhook notifications.

### Usage
```bash
evalstudio webhook set <url>
evalstudio webhook remove
```

### Options
| Flag | Description |
|------|-------------|
| `--eval <id>` | Apply to specific eval |
```

**For configuration:**
```markdown
## Webhook Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `webhookUrl` | string | - | URL to notify |
```

## 4. Update Navigation

If adding new pages, update sidebar configuration.

## 5. Preview (optional)

```bash
cd packages/docs && yarn start
```
