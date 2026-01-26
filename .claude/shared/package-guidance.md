# Package Implementation Guidance

**Before implementing any feature, ensure you've read:**
- `specs/SPEC.md` - Product requirements, UI structure, user workflows
- `specs/ARCHITECTURE.md` - System components, connector/evaluator interfaces, tech stack

---

## Core Package (`evalstudio`)

**Types & Interfaces:**
- Define types in `packages/core/src/types/`
- Update Zod schemas for validation
- Export from package index

**Implementation:**
- Follow existing patterns
- Use message-based communication format
- Add descriptive error messages

**Tests:**
- Unit tests for new functions/classes
- Integration tests if needed
- Test edge cases and errors

## CLI Package (`@evalstudio/cli`)

**Commands:**
- Add in `packages/cli/src/commands/`
- Update help text and examples
- Add interactive prompts (Inquirer.js) if needed

**Output:**
- Format terminal output appropriately
- Add progress indicators for long operations
- Support `--json` flag for CI/CD

## API Package (`@evalstudio/api`)

**Endpoints:**
- Add in `packages/api/src/routes/`
- Define request/response schemas
- Add input validation
- Use appropriate HTTP status codes

**WebSocket:**
- Add events for real-time features
- Document event payloads

## Web Package (`@evalstudio/web`)

**Components:**
- Add in `packages/web/src/components/`
- Follow shadcn/ui patterns
- Ensure responsive design
- Add loading and error states

**State & Data:**
- Use TanStack Query for API calls
- Handle optimistic updates
- Add cache invalidation

**Forms:**
- Use React Hook Form
- Add Zod validation
- Display errors clearly
