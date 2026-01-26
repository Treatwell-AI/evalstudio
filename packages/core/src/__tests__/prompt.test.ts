import { describe, expect, it } from "vitest";
import { buildTestAgentSystemPrompt, buildTestAgentMessages } from "../prompt.js";

describe("prompt", () => {
  describe("buildTestAgentSystemPrompt", () => {
    it("returns base instructions when no persona or scenario", () => {
      const prompt = buildTestAgentSystemPrompt({});

      expect(prompt).toContain("You are a test agent");
      expect(prompt).toContain("simulating a user interaction");
      expect(prompt).toContain("## Guidelines");
    });

    it("includes persona information", () => {
      const prompt = buildTestAgentSystemPrompt({
        persona: {
          name: "Frustrated Customer",
          description: "A customer who has had multiple bad experiences",
          systemPrompt: "Be impatient and demand quick resolution",
        },
      });

      expect(prompt).toContain("## User Persona");
      expect(prompt).toContain("Name:");
      expect(prompt).toContain("Frustrated Customer");
      expect(prompt).toContain("Character Instructions:");
      expect(prompt).toContain("Be impatient and demand quick resolution");
    });

    it("includes scenario information", () => {
      const prompt = buildTestAgentSystemPrompt({
        scenario: {
          name: "Booking Cancellation",
          instructions: "Customer wants to cancel a booking made yesterday. 24h cancellation policy applies.",
        },
      });

      expect(prompt).toContain("## Scenario");
      expect(prompt).toContain("Customer wants to cancel a booking");
    });

    it("combines persona and scenario", () => {
      const prompt = buildTestAgentSystemPrompt({
        persona: {
          name: "VIP Customer",
          description: "Long-time loyal customer",
          systemPrompt: "Expect premium treatment",
        },
        scenario: {
          name: "Late Delivery",
          instructions: "Order arrived 3 days late",
        },
      });

      expect(prompt).toContain("## User Persona");
      expect(prompt).toContain("VIP Customer");
      expect(prompt).toContain("## Scenario");
      expect(prompt).toContain("Order arrived 3 days late");
      expect(prompt).toContain("## Guidelines");
    });

    it("handles partial persona (only some fields)", () => {
      const prompt = buildTestAgentSystemPrompt({
        persona: {
          name: "Test User",
          description: undefined,
          systemPrompt: undefined,
        },
      });

      expect(prompt).toContain("Name:");
      expect(prompt).toContain("Test User");
      expect(prompt).toContain("Character Instructions:");
      expect(prompt).toContain("N/A");
    });

    it("handles null persona and scenario", () => {
      const prompt = buildTestAgentSystemPrompt({
        persona: null,
        scenario: null,
      });

      expect(prompt).toContain("You are a test agent");
      expect(prompt).not.toContain("## User Persona");
      expect(prompt).not.toContain("## Scenario");
    });
  });

  describe("buildTestAgentMessages", () => {
    it("returns messages array with system prompt", () => {
      const messages = buildTestAgentMessages({
        persona: { name: "Test", description: "A test persona", systemPrompt: "Be helpful" },
        scenario: { name: "Test Scenario", instructions: "Test instructions" },
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are a test agent");
      expect(messages[0].content).toContain("Test");
      expect(messages[0].content).toContain("Test instructions");
    });

    it("returns empty system prompt with no persona/scenario", () => {
      const messages = buildTestAgentMessages({});

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are a test agent");
    });

    it("includes scenario seed messages after system prompt", () => {
      const messages = buildTestAgentMessages({
        persona: { name: "Test", description: "A test persona", systemPrompt: "Be helpful" },
        scenario: {
          name: "Mid-conversation",
          instructions: "Continue the cancellation flow",
          messages: [
            { role: "user", content: "Hi, I need to cancel my appointment" },
            { role: "assistant", content: "I'd be happy to help. What's your booking reference?" },
            { role: "user", content: "It's ABC123" },
          ],
        },
      });

      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are a test agent");
      expect(messages[1]).toEqual({ role: "user", content: "Hi, I need to cancel my appointment" });
      expect(messages[2]).toEqual({ role: "assistant", content: "I'd be happy to help. What's your booking reference?" });
      expect(messages[3]).toEqual({ role: "user", content: "It's ABC123" });
    });

    it("handles scenario with empty messages array", () => {
      const messages = buildTestAgentMessages({
        scenario: {
          name: "Test",
          instructions: "Test instructions",
          messages: [],
        },
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
    });

    it("handles scenario with undefined messages", () => {
      const messages = buildTestAgentMessages({
        scenario: {
          name: "Test",
          instructions: "Test instructions",
          messages: undefined,
        },
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
    });
  });
});
