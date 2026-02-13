---
sidebar_position: 4
---

# evalstudio scenario

Manage test scenarios. Scenarios contain instructions that provide all the context needed for testing conversations. Scenarios can also include initial messages to seed conversations from a specific point.

## Usage

```bash
evalstudio scenario <command> [options]
```

## Commands

### create

Create a new scenario.

```bash
evalstudio scenario create <name> [options]
```

| Option | Description |
|--------|-------------|
| `-i, --instructions <instructions>` | Instructions for the scenario |
| `-m, --messages-file <file>` | Path to JSON file with initial messages |
| `--max-messages <number>` | Maximum conversation turns |
| `--success-criteria <criteria>` | Success criteria in natural language |
| `--failure-criteria <criteria>` | Failure criteria in natural language |
| `--personas <names>` | Comma-separated persona names to associate |
| `--json` | Output as JSON |

**Example:**

```bash
# Create with instructions and evaluation criteria
evalstudio scenario create booking-cancellation \
  -i "Customer wants to cancel a haircut appointment for tomorrow." \
  --max-messages 10 \
  --success-criteria "Agent confirms cancellation" \
  --failure-criteria "Agent fails to process"

# Create with initial messages from a file
evalstudio scenario create mid-conversation \
  -i "Continue the cancellation flow" \
  -m ./conversation-seed.json
```

**Messages file format (conversation-seed.json):**

```json
[
  { "role": "user", "content": "Hi, I need to cancel my appointment" },
  { "role": "assistant", "content": "I'd be happy to help. Can you provide your booking reference?" },
  { "role": "user", "content": "It's ABC123" }
]
```

Output:
```
Scenario created successfully
  ID:           987fcdeb-51a2-3bc4-d567-890123456789
  Name:         booking-cancellation
  Instructions: Customer wants to cancel a haircut appointment for tomorrow.
  Max Msgs:     10
  Success:      Agent confirms cancellation
  Failure:      Agent fails to process
  Created:      2026-01-28T10:00:00.000Z
```

### list

List scenarios.

```bash
evalstudio scenario list [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio scenario list
```

Output:
```
Scenarios:
----------
  booking-cancellation (987fcdeb-51a2-3bc4-d567-890123456789)
    Customer wants to cancel a haircut appointment for tomorrow...
  reschedule-appointment (abc12345-6789-def0-1234-567890abcdef)
    Customer wants to move their appointment to next week...
```

### show

Show scenario details.

```bash
evalstudio scenario show <identifier> [options]
```

The identifier can be the scenario ID or name.

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio scenario show booking-cancellation
```

Output:
```
Scenario: booking-cancellation
----------
  ID:           987fcdeb-51a2-3bc4-d567-890123456789
  Name:         booking-cancellation
  Instructions: Customer wants to cancel a haircut appointment for tomorrow. They have a scheduling conflict. Booking was made 3 days ago with 24h cancellation policy.
  Created:      2026-01-28T10:00:00.000Z
  Updated:      2026-01-28T10:00:00.000Z
```

### update

Update a scenario.

```bash
evalstudio scenario update <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | New scenario name |
| `-i, --instructions <instructions>` | New instructions |
| `-m, --messages-file <file>` | Path to JSON file with new initial messages |
| `--max-messages <number>` | New max messages |
| `--success-criteria <criteria>` | New success criteria |
| `--failure-criteria <criteria>` | New failure criteria |
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio scenario update 987fcdeb-51a2-3bc4-d567-890123456789 \
  -i "Customer wants to cancel appointment. VIP customer with flexible policy." \
  --max-messages 15
```

### delete

Delete a scenario.

```bash
evalstudio scenario delete <identifier> [options]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Example:**

```bash
evalstudio scenario delete 987fcdeb-51a2-3bc4-d567-890123456789
```

Output:
```
Scenario "booking-cancellation" deleted successfully
```

## JSON Output

All commands support the `--json` flag for machine-readable output, useful for scripts and CI/CD pipelines.

```bash
evalstudio scenario list --json
```

Output:
```json
[
  {
    "id": "987fcdeb-51a2-3bc4-d567-890123456789",
    "name": "booking-cancellation",
    "instructions": "Customer wants to cancel a haircut appointment for tomorrow.",
    "maxMessages": 10,
    "successCriteria": "Agent confirms cancellation",
    "failureCriteria": "Agent fails to process",
    "createdAt": "2026-01-28T10:00:00.000Z",
    "updatedAt": "2026-01-28T10:00:00.000Z"
  }
]
```
