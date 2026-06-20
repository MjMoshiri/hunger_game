const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-4.3";
const DEFAULT_MAX_RETRIES = 6;
const MAX_COMPLETION_TOKENS = 4096;
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

interface ChatCompletion {
  choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
}

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
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

function buildPrompt(title1: string, title2: string): string {
  return `Compare these two introduction post titles for a founder introducing a new company.

The company uses LLM-powered tournament-style evaluations to help teams pick the best ideas, copy, campaigns, strategies, candidates, or content.

Target audience: tech bros — founders, AI builders, growth people, product leaders, and VC-adjacent operators.

Choose the title that is more scroll-stopping, clear, novel, and likely to drive engagement.

You have ${POINTS_PER_MATCH} points to distribute between the two titles based on which is stronger. The points must sum to exactly ${POINTS_PER_MATCH} (for example 5-0, 4-1, or 3-2). Give concise pros and cons for each title.

Title A: ${title1}
Title B: ${title2}`;
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

function retryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return null;
  }
  return Math.max(0, date - Date.now());
}

export async function judgePair(
  title1: string,
  title2: string,
  options: JudgeOptions = {},
): Promise<JudgeVerdict> {
  const apiKey = options.apiKey ?? process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set");
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const body = JSON.stringify({
    model: options.model ?? process.env.XAI_MODEL ?? DEFAULT_MODEL,
    max_tokens: MAX_COMPLETION_TOKENS,
    messages: [{ role: "user", content: buildPrompt(title1, title2) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "title_comparison",
        strict: true,
        schema: VERDICT_SCHEMA,
      },
    },
  });

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(XAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
      const completion = (await response.json()) as ChatCompletion;
      const choice = completion.choices[0];
      const content = choice?.message?.content;
      const verdict = content ? parseVerdict(content) : null;
      if (verdict && choice?.finish_reason !== "length") {
        return verdict;
      }
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt), options.signal);
        continue;
      }
      throw new Error(
        `xAI response could not be parsed (finish_reason=${choice?.finish_reason ?? "unknown"}): ${content ?? "<empty>"}`,
      );
    }

    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const delay = retryAfterMs(response.headers.get("retry-after")) ?? backoffDelay(attempt);
      await response.text();
      await sleep(delay, options.signal);
      continue;
    }

    throw new Error(`xAI request failed (${response.status}): ${await response.text()}`);
  }
}
