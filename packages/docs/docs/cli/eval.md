---
sidebar_position: 5
---

# evalstudio eval

Manage evals. Evals can contain multiple scenarios to create comprehensive test collections. Personas are associated with scenarios, not with evals directly. When running an eval, runs are created for each scenario/persona combination.

Note: The CLI currently supports specifying a single scenario via `--scenario`. For multi-scenario evals, use the REST API or web UI.

## Usage

```bash
evalstudio eval <command> [options]
```

## Commands

### create

Create a new eval.

```bash
evalstudio eval create [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Eval name (required) |
| `-c, --connector <connector>` | Connector ID or name (required) |
| `--scenario <scenario>` | Scenario ID or name (required) |
| `--json` | Output as JSON |

Note: LLM provider for evaluation is configured at the project level in `evalstudio.config.json`.

**Example:**

```bash
evalstudio eval create \
  -n "Booking Test Suite" \
  -c "My Agent Connector" \
  --scenario "Booking Cancellation"
```

Output:
```
Eval created successfully
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        Booking Test Suite
  Connector:   My Agent Connector
  Scenario:    Booking Cancellation
  Success:     Agent confirms cancellation and explains refund policy
  Failure:     Agent fails to process cancellation
  Max Msgs:    10
  Created:     2026-01-28T10:00:00.000Z
```

### list

List evals.

```bash
evalstudio eval list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio eval list
```

Output:
```
Evals:
------
  Booking Test Suite (987fcdeb-51a2-3bc4-d567-890123456789)
  Full Agent Suite (abc12345-6789-def0-1234-567890abcdef)
    Scenarios: 3
```

Note: When an eval has multiple scenarios, the scenario count is displayed.

### show

Show eval details.

```bash
evalstudio eval show <id> [options]
```

| Option | Description |
|--------|-------------|
| `--expand` | Include scenario details |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio eval show 987fcdeb-51a2-3bc4-d567-890123456789 --expand
```

Output:
```
Eval: Booking Test Suite
------
  ID:          987fcdeb-51a2-3bc4-d567-890123456789
  Name:        Booking Test Suite
  Success:     Agent confirms cancellation and explains refund policy
  Failure:     Agent fails to process cancellation
  Max Msgs:    10
  Scenarios:
    - Booking Cancellation
      Customer needs to cancel an appointment
    - Booking Modification
      Customer needs to change date
  Created:     2026-01-28T10:00:00.000Z
  Updated:     2026-01-28T10:00:00.000Z
```

### update

Update an eval.

```bash
evalstudio eval update <id> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New eval name |
| `--scenario <scenario>` | New scenario ID or name (replaces all existing scenarios) |
| `--connector <connector>` | New connector ID or name |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio eval update 987fcdeb-51a2-3bc4-d567-890123456789 \
  -n "Updated Test Suite" \
  --scenario "New Scenario"
```

Note: The `--scenario` option replaces all existing scenarios with the specified one. For managing multiple scenarios, use the REST API or web UI.

### delete

Delete an eval.

```bash
evalstudio eval delete <id> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio eval delete 987fcdeb-51a2-3bc4-d567-890123456789
```

Output:
```
Eval "Booking Cancellation" deleted successfully
```

## Display Name

Evals are displayed using their name. If no name is set, the eval ID is used.

## Scenarios and Run Creation

Evals can contain multiple scenarios. When running an eval:

1. The system iterates through each scenario
2. For each scenario, it uses the personas associated with that scenario
3. A run is created for each scenario/persona combination

For example, if an eval has 2 scenarios, and each scenario has 3 personas, creating runs produces 6 runs (2 x 3).

Personas are associated with scenarios, not with evals directly. This allows different scenarios to test different persona types.

## JSON Output

All commands support the `--json` flag for machine-readable output, useful for scripts and CI/CD pipelines.

```bash
evalstudio eval list --json
```

Output:
```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "Booking Test Suite",
    "connectorId": "connector-uuid",
    "input": [],
    "scenarioIds": ["scenario-uuid-1", "scenario-uuid-2"],
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
