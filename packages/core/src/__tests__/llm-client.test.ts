import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, getDefaultModelForProvider } from "../llm-client.js";
import type { LLMProvider } from "../llm-provider.js";

const mockFetch = vi.fn();

function makeProvider(provider: "openai" | "anthropic"): LLMProvider {
  return {
    provider,
    apiKey: "test-api-key",
  };
}

describe("llm-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDefaultModelForProvider", () => {
    it("returns gpt-4o-mini for openai", () => {
      expect(getDefaultModelForProvider("openai")).toBe("gpt-4o-mini");
    });

    it("returns claude-3-5-haiku for anthropic", () => {
      expect(getDefaultModelForProvider("anthropic")).toBe("claude-3-5-haiku-20241022");
    });
  });

  describe("chatCompletion - OpenAI", () => {
    it("sends correct request and extracts content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "Hello from OpenAI" } }],
        }),
      });

      const result = await chatCompletion(
        makeProvider("openai"),
        [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
        { model: "gpt-4o" }
      );

      expect(result.content).toBe("Hello from OpenAI");

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Authorization": "Bearer test-api-key",
            "Content-Type": "application/json",
          },
        })
      );

      // Verify request body
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("gpt-4o");
      expect(body.messages).toEqual([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ]);
    });

    it("uses default model when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
      });

      await chatCompletion(makeProvider("openai"), [{ role: "user", content: "Hi" }]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("gpt-4o-mini");
    });

    it("includes temperature when specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
      });

      await chatCompletion(
        makeProvider("openai"),
        [{ role: "user", content: "Hi" }],
        { temperature: 0.5 }
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.5);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        chatCompletion(makeProvider("openai"), [{ role: "user", content: "Hi" }])
      ).rejects.toThrow("OpenAI API error (401): Unauthorized");
    });

    it("throws when response has no content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { role: "assistant" } }] }),
      });

      await expect(
        chatCompletion(makeProvider("openai"), [{ role: "user", content: "Hi" }])
      ).rejects.toThrow("OpenAI API returned no content in response");
    });
  });

  describe("chatCompletion - Anthropic", () => {
    it("sends correct request with system extraction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Hello from Anthropic" }],
        }),
      });

      const result = await chatCompletion(
        makeProvider("anthropic"),
        [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
        { model: "claude-3-5-sonnet-20241022" }
      );

      expect(result.content).toBe("Hello from Anthropic");

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: {
            "x-api-key": "test-api-key",
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        })
      );

      // Verify request body
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("claude-3-5-sonnet-20241022");
      expect(body.system).toBe("You are helpful.");
      expect(body.max_tokens).toBe(4096);
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    });

    it("merges consecutive same-role messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
        }),
      });

      await chatCompletion(makeProvider("anthropic"), [
        { role: "user", content: "First message" },
        { role: "user", content: "Second message" },
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toEqual([
        { role: "user", content: "First message\n\nSecond message" },
      ]);
    });

    it("handles alternating messages correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
        }),
      });

      await chatCompletion(makeProvider("anthropic"), [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe("System prompt");
      expect(body.messages).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ]);
    });

    it("omits system field when no system message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
        }),
      });

      await chatCompletion(makeProvider("anthropic"), [
        { role: "user", content: "Hi" },
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBeUndefined();
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"Invalid request"}}',
      });

      await expect(
        chatCompletion(makeProvider("anthropic"), [{ role: "user", content: "Hi" }])
      ).rejects.toThrow('Anthropic API error (400)');
    });

    it("throws when response has no text content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] }),
      });

      await expect(
        chatCompletion(makeProvider("anthropic"), [{ role: "user", content: "Hi" }])
      ).rejects.toThrow("Anthropic API returned no text content in response");
    });
  });

  describe("chatCompletion - unsupported provider", () => {
    it("throws for unknown provider type", async () => {
      const provider = makeProvider("openai");
      (provider as unknown as { provider: string }).provider = "unknown";

      await expect(
        chatCompletion(provider, [{ role: "user", content: "Hi" }])
      ).rejects.toThrow("Unsupported LLM provider: unknown");
    });
  });
});
