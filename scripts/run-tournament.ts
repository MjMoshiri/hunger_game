import { config } from "dotenv";

config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runRoundRobin } from "../src/engine";
import { parsePhrases } from "./parse-phrases";

const SOURCE_FILE = "data.txt";
const OUTPUT_FILE = "data/tournament-result.json";

async function main(): Promise<void> {
  const entries = parsePhrases(SOURCE_FILE);
  const concurrency = Number(process.env.GEMINI_CONCURRENCY ?? 12);
  const ownerById = new Map(entries.map((entry) => [entry.id, entry.owner]));

  console.log(`Running round-robin over ${entries.length} phrases (concurrency ${concurrency})`);

  const result = await runRoundRobin(
    entries.map((entry) => entry.phrase),
    {
      name: "billboard-phrases",
      concurrency,
      onMatch: (completed, total) => {
        if (completed % 25 === 0 || completed === total) {
          console.log(`  ${completed}/${total} matches judged`);
        }
      },
    },
  );

  const standings = result.standings.map((standing) => ({
    ...standing,
    owner: ownerById.get(standing.playerId) ?? "unknown",
  }));

  const output = {
    source: SOURCE_FILE,
    entries,
    standings,
    verdicts: result.verdicts,
    failures: result.failures,
    serialized: result.serialized,
  };

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`\nDone. ${result.verdicts.length} verdicts, ${result.failures.length} failures.`);
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
