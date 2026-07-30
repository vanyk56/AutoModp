// OpenRouter image generation client
// Uses OpenRouter's OpenAI-compatible image generation endpoint

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  throw new Error(
    "OPENROUTER_API_KEY must be set for image generation."
  );
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash";

export const ai = { models: {} }; // compat stub

export async function generateImage(
  prompt: string
): Promise<{ b64_json: string; mimeType: string }> {
  // Use chat completion with an image-capable model to generate images
  // OpenRouter supports image generation through compatible models
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://automind.app",
      "X-Title": "AutoMind Bot",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [
        {
          role: "user",
          content: `Generate an image: ${prompt}`,
        },
      ],
      response_format: { type: "image" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter image error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.content;

  // Try to extract base64 image from the response
  if (data.data?.[0]?.b64_json) {
    return {
      b64_json: data.data[0].b64_json,
      mimeType: "image/png",
    };
  }

  // If response contains image URL, fetch and convert to base64
  if (data.data?.[0]?.url) {
    const imgRes = await fetch(data.data[0].url);
    const buffer = await imgRes.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");
    return { b64_json: b64, mimeType: "image/png" };
  }

  throw new Error("No image data in OpenRouter response. Image generation may not be supported by the selected model.");
}
