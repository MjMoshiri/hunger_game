import { readFileSync } from "node:fs";

export interface PhraseEntry {
  readonly id: string;
  readonly owner: string;
  readonly phrase: string;
}

const MODELS = ["Gemini", "Claude", "Deepseek", "Grok", "GPT"];
const STOP_HEADERS = ["Original Prompt", "Judgment Proompt", "Judgment Prompt"];

function clean(line: string): string {
  return line
    .replace(/^\d+\.\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

export function parsePhrases(filePath: string): PhraseEntry[] {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries: PhraseEntry[] = [];
  let owner: string | null = null;
  let index = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (STOP_HEADERS.some((header) => header.toLowerCase() === trimmed.toLowerCase())) {
      break;
    }
    const header = MODELS.find((model) => model.toLowerCase() === trimmed.toLowerCase());
    if (header) {
      owner = header;
      continue;
    }
    if (!owner || trimmed === "") {
      continue;
    }
    const phrase = clean(trimmed);
    if (phrase === "") {
      continue;
    }
    index += 1;
    entries.push({ id: String(index), owner, phrase });
  }

  return entries;
}
