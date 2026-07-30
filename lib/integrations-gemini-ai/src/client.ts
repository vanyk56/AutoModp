// OpenRouter AI client — OpenAI-compatible API
// https://openrouter.ai/docs

const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  throw new Error(
    "OPENROUTER_API_KEY not found. " +
    "Get your API key from https://openrouter.ai/keys"
  );
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Default model — can be overridden per-call
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash-lite";

interface ContentPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

interface Content {
  role: string;
  parts: ContentPart[];
}

interface GenerateContentParams {
  model?: string;
  contents: Content[];
  config?: {
    maxOutputTokens?: number;
    responseModalities?: string[];
  };
}

function resolveModel(model?: string): string {
  if (!model) return DEFAULT_MODEL;
  // Strip legacy "ag/" prefix
  if (model.startsWith("ag/")) {
    return "google/" + model.slice(3);
  }
  // Strip legacy "antigravity/" prefix
  if (model.startsWith("antigravity/")) {
    return "google/" + model.slice(12);
  }
  return model;
}

function contentsToMessages(contents: Content[]) {
  return contents.map((c) => ({
    role: c.role === "model" ? "assistant" : c.role,
    content: c.parts?.[0]?.text || "",
  }));
}

async function callOpenRouter(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens?: number,
  stream: boolean = false
) {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://automind.app",
      "X-Title": "AutoMind Bot",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errText}`);
  }

  return response;
}

// Build an object that mimics the old `ai.models` interface
// so all existing code (`ai.models.generateContent(...)`) keeps working unchanged.
const models = {
  async generateContent(params: GenerateContentParams) {
    const model = resolveModel(params.model);
    const messages = contentsToMessages(params.contents);

    const res = await callOpenRouter(
      model,
      messages,
      params.config?.maxOutputTokens,
      false
    );
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    return { text };
  },

  async generateContentStream(params: GenerateContentParams) {
    const model = resolveModel(params.model);
    const messages = contentsToMessages(params.contents);

    const res = await callOpenRouter(
      model,
      messages,
      params.config?.maxOutputTokens,
      true
    );

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    async function* makeStream() {
      let buffer = "";
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned.startsWith("data: ")) continue;
          const dataStr = cleaned.slice(6);
          if (dataStr === "[DONE]") return;
          try {
            const parsed = JSON.parse(dataStr);
            const text = parsed.choices?.[0]?.delta?.content || "";
            if (text) {
              yield { text };
            }
          } catch {}
        }
      }
    }

    return makeStream();
  },
};

export const ai = { models };
