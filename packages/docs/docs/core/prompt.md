---
sidebar_position: 8
---

# Prompt

Build system prompts for the test agent that simulates user personas during evaluation runs. The test agent uses these prompts to impersonate users and interact with chatbots being tested.

## Import

```typescript
import {
  buildTestAgentSystemPrompt,
  buildTestAgentMessages,
  type BuildTestAgentPromptInput,
} from "evalstudio";
```

## Types

### BuildTestAgentPromptInput

```typescript
interface BuildTestAgentPromptInput {
  persona?: Pick<Persona, "name" | "description" | "systemPrompt"> | null;
  scenario?: Pick<Scenario, "name" | "instructions"> | null;
}
```

## Functions

### buildTestAgentSystemPrompt()

Builds the system prompt for the test agent that will impersonate a user persona and simulate a scenario when interacting with the chatbot being tested.

```typescript
function buildTestAgentSystemPrompt(input: BuildTestAgentPromptInput): string;
```

The generated prompt includes:

- Base instructions explaining the test agent's role
- User persona section with name and character instructions (if provided)
- Scenario section with context (if provided)
- Guidelines for staying in character and behaving naturally

```typescript
const systemPrompt = buildTestAgentSystemPrompt({
  persona: {
    name: "Frustrated Customer",
    description: "A customer who has had multiple bad experiences",
    systemPrompt: "Be impatient and demand quick resolution",
  },
  scenario: {
    name: "Booking Cancellation",
    instructions: "Customer wants to cancel their booking made yesterday. 24h cancellation policy applies.",
  },
});

// Output:
// You are a test agent simulating a user interaction with a chatbot.
// Your role is to impersonate a specific user persona...
//
// ## User Persona
//
// Name:
// Frustrated Customer
//
// Character Instructions:
// Be impatient and demand quick resolution
//
// ## Scenario
//
// Customer wants to cancel their booking made yesterday...
//
// ## Guidelines
//
// - Stay in character as the user persona throughout the conversation
// - Follow the scenario context to guide your messages and goals
// ...
```

### buildTestAgentMessages()

Builds a messages array in OpenAI format for the test agent, starting with the system prompt.

```typescript
function buildTestAgentMessages(
  input: BuildTestAgentPromptInput
): Array<{ role: "system" | "user" | "assistant"; content: string }>;
```

```typescript
const messages = buildTestAgentMessages({
  persona: { name: "Test User", description: "A test persona", systemPrompt: "Be helpful" },
  scenario: { name: "Test Scenario", instructions: "Test context" },
});

// messages = [
//   { role: "system", content: "You are a test agent..." }
// ]
```

## Usage with EvalWithRelations

The prompt functions accept partial persona/scenario objects, making them compatible with `EvalWithRelations`:

```typescript
const evalItem = getEvalWithRelations(evalId);

const systemPrompt = buildTestAgentSystemPrompt({
  persona: evalItem.persona,
  scenario: evalItem.scenario,
});
```

## Null Handling

Both persona and scenario are optional. If not provided or null, their sections are omitted from the prompt:

```typescript
// No persona or scenario
const minimalPrompt = buildTestAgentSystemPrompt({});
// Only includes base instructions and guidelines

// With null values
const nullPrompt = buildTestAgentSystemPrompt({
  persona: null,
  scenario: null,
});
// Same as above
```
