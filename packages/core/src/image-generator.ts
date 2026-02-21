/**
 * Image generator for persona portraits.
 *
 * Uses OpenAI's gpt-image-1 model:
 * - When style references exist: /v1/images/edits with the reference images
 *   passed directly so the model can see and reproduce the style.
 * - When no references: /v1/images/generations with a cartoon-style prompt.
 *
 * Requires an OpenAI API key (image generation is OpenAI-only).
 */

import { Blob } from "node:buffer";

export interface GeneratePersonaImageInput {
  /** OpenAI API key */
  apiKey: string;
  /** The persona's system prompt describing personality/traits */
  systemPrompt: string;
  /** The persona's name (used in the prompt) */
  personaName: string;
  /** Raw image buffers of style reference images (optional) */
  styleReferenceImages?: Buffer[];
}

export interface GeneratePersonaImageResult {
  /** The generated image as a base64-encoded PNG */
  imageBase64: string;
}

/**
 * Builds the persona portrait prompt.
 */
function buildPrompt(personaName: string, systemPrompt: string, hasStyleRef: boolean): string {
  const styleInstruction = hasStyleRef
    ? "Match the exact artistic style, color palette, and visual aesthetic of the provided reference image(s). Exclude any accessorys or background elements from the references, focusing solely on replicating the style."
    : "Use a colorful cartoon-style illustration: friendly, expressive, clean lines, vibrant colors.";

  return `Create a portrait/avatar of a character named "${personaName}".

Character personality traits:
${systemPrompt}

Style: ${styleInstruction}

Requirements:
- Head and shoulders portrait, centered
- Expressive face that reflects the personality traits
- Clean background with subtle color
- No text or labels in the image`;
}

/**
 * Extracts base64 image data from an OpenAI Images API response.
 */
async function extractBase64FromResponse(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI ${label} error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const entry = data.data[0];
  if (entry?.b64_json) {
    return entry.b64_json;
  }

  if (entry?.url) {
    const imgResponse = await fetch(entry.url);
    const arrayBuf = await imgResponse.arrayBuffer();
    return Buffer.from(arrayBuf).toString("base64");
  }

  throw new Error("OpenAI Images API returned no image data");
}

/**
 * Calls the OpenAI Images API — /v1/images/edits when style references are
 * provided, /v1/images/generations otherwise — and returns base64 PNG data.
 */
async function callOpenAIImagesAPI(
  apiKey: string,
  prompt: string,
  styleImages?: Buffer[],
): Promise<string> {
  if (styleImages && styleImages.length > 0) {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("size", "1024x1024");

    for (let i = 0; i < styleImages.length; i++) {
      const blob = new Blob([styleImages[i]], { type: "image/png" });
      form.append("image[]", blob, `reference-${i}.png`);
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    return extractBase64FromResponse(response, "Images Edit API");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  return extractBase64FromResponse(response, "Images API");
}

/**
 * Generates a persona portrait image using OpenAI's gpt-image-1 model.
 *
 * If style reference images are provided, they are passed directly to the
 * model via the /v1/images/edits endpoint so it can see and reproduce the
 * exact style. If no references, defaults to a cartoon-style portrait via
 * /v1/images/generations.
 */
export async function generatePersonaImage(
  input: GeneratePersonaImageInput,
): Promise<GeneratePersonaImageResult> {
  const { apiKey, systemPrompt, personaName, styleReferenceImages } = input;

  if (!systemPrompt) {
    throw new Error("Persona must have a systemPrompt to generate an image from");
  }

  const hasStyleRef = !!styleReferenceImages && styleReferenceImages.length > 0;
  const prompt = buildPrompt(personaName, systemPrompt, hasStyleRef);
  const imageBase64 = await callOpenAIImagesAPI(apiKey, prompt, styleReferenceImages);

  return { imageBase64 };
}
