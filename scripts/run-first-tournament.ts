import { readFile, writeFile } from "node:fs/promises";

import { config } from "dotenv";

import { runRoundRobin } from "../src/engine";

config({ path: ".env.local" });

const INPUT_PATH = "data/first-tournament.txt";
const OUTPUT_PATH = "data/first-tournament-result.json";

function parseTitles(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\d+\.\s*/, ""));
}

async function main(): Promise<void> {
  const titles = parseTitles(await readFile(INPUT_PATH, "utf8"));
  console.log(`Loaded ${titles.length} titles from ${INPUT_PATH}`);

  const result = await runRoundRobin(titles, {
    name: "first-tournament",
    concurrency: 32,
    onMatch: (completed, total) => {
      process.stdout.write(`\rJudged ${completed}/${total} matches`);
    },
  });
  process.stdout.write("\n");

  if (result.failures.length > 0) {
    console.warn(`${result.failures.length} matches failed and were recorded as 0–0:`);
    for (const failure of result.failures) {
      console.warn(`  - "${failure.title1}" vs "${failure.title2}": ${failure.error}`);
    }
  }

  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        standings: result.standings,
        verdicts: result.verdicts,
        tournament: JSON.parse(result.serialized),
      },
      null,
      2,
    ),
  );

  console.log(`Saved results to ${OUTPUT_PATH}`);
  console.log("Top 5:");
  for (const standing of result.standings.slice(0, 5)) {
    console.log(`  ${standing.rank}. [${standing.rating}] ${standing.name}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
