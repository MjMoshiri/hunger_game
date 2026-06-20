const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_MAX_RETRIES = 6;
const MAX_OUTPUT_TOKENS = 4096;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;

export const POINTS_PER_MATCH = 5;

export interface JudgeVerdict {
  readonly item1Pros: string;
  readonly item1Cons: string;
  readonly item2Pros: string;
  readonly item2Cons: string;
  readonly item1Points: number;
  readonly item2Points: number;
}

export interface JudgeOptions {
  readonly model?: string;
  readonly apiKey?: string;
  readonly signal?: AbortSignal;
  readonly maxRetries?: number;
}

interface RawVerdict {
  item1_pros: string;
  item1_cons: string;
  item2_pros: string;
  item2_cons: string;
  item1_points: number;
  item2_points: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

interface GeminiError {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{ "@type"?: string; retryDelay?: string }>;
  };
}

const VERDICT_SCHEMA = {
  type: "object",
  required: [
    "item1_pros",
    "item1_cons",
    "item2_pros",
    "item2_cons",
    "item1_points",
    "item2_points",
  ],
  properties: {
    item1_pros: { type: "string" },
    item1_cons: { type: "string" },
    item2_pros: { type: "string" },
    item2_cons: { type: "string" },
    item1_points: { type: "integer", minimum: 0, maximum: POINTS_PER_MATCH },
    item2_points: { type: "integer", minimum: 0, maximum: POINTS_PER_MATCH },
  },
  propertyOrdering: [
    "item1_pros",
    "item1_cons",
    "item2_pros",
    "item2_cons",
    "item1_points",
    "item2_points",
  ],
} as const;

function parseVerdict(content: string): JudgeVerdict | null {
  let raw: RawVerdict;
  try {
    raw = JSON.parse(content) as RawVerdict;
  } catch {
    return null;
  }
  if (
    typeof raw.item1_points !== "number" ||
    typeof raw.item2_points !== "number" ||
    typeof raw.item1_pros !== "string"
  ) {
    return null;
  }
  return {
    item1Pros: raw.item1_pros,
    item1Cons: raw.item1_cons,
    item2Pros: raw.item2_pros,
    item2Cons: raw.item2_cons,
    item1Points: raw.item1_points,
    item2Points: raw.item2_points,
  };
}

function buildPrompt(phrase1: string, phrase2: string): string {
  return `Compare these two billboard-style phrases for a company.

The company helps teams find the best option by running AI-powered competitions between ideas, copy, campaigns, candidates, product concepts, slogans, and other business assets.

Choose the phrase that would work better in marketing.

Prioritize the phrase that is:
- More instantly understandable
- More memorable
- More emotionally compelling
- More differentiated
- More likely to make someone curious
- Better suited for a billboard, website hero, or launch campaign
- Focused on the outcome, not the technical process

Avoid phrases that feel generic, overly technical, too narrow, or hard to grasp quickly.

You have ${POINTS_PER_MATCH} points to distribute between the two phrases based on which is stronger. The points must sum to exactly ${POINTS_PER_MATCH} (for example 5-0, 4-1, or 3-2). Give concise pros and cons for each phrase.

Phrase A: ${phrase1}
Phrase B: ${phrase2}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function backoffDelay(attempt: number): number {
  const exponential = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** attempt);
  return exponential / 2 + Math.random() * (exponential / 2);
}

function retryDelayMs(body: GeminiError): number | null {
  const retryInfo = body.error?.details?.find((detail) =>
    detail["@type"]?.includes("RetryInfo"),
  );
  if (!retryInfo?.retryDelay) {
    return null;
  }
  const seconds = Number(retryInfo.retryDelay.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

export async function judgePair(
  phrase1: string,
  phrase2: string,
  options: JudgeOptions = {},
): Promise<JudgeVerdict> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent`;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: buildPrompt(phrase1, phrase2) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: VERDICT_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: options.signal,
        body,
      });
    } catch (error) {
      if (options.signal?.aborted || attempt >= maxRetries) {
        throw error;
      }
      await sleep(backoffDelay(attempt), options.signal);
      continue;
    }

    if (response.ok) {
      const result = (await response.json()) as GeminiResponse;
      const candidate = result.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text;
      const verdict = content ? parseVerdict(content) : null;
      if (verdict && candidate?.finishReason !== "MAX_TOKENS") {
        return verdict;
      }
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt), options.signal);
        continue;
      }
      throw new Error(
        `Gemini response could not be parsed (finishReason=${candidate?.finishReason ?? "unknown"}): ${content ?? "<empty>"}`,
      );
    }

    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      let parsedDelay: number | null = null;
      try {
        parsedDelay = retryDelayMs((await response.clone().json()) as GeminiError);
      } catch {
        parsedDelay = null;
      }
      await response.text();
      await sleep(parsedDelay ?? backoffDelay(attempt), options.signal);
      continue;
    }

    throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
  }
}
