import { mkdir, readFile, writeFile } from "node:fs/promises";

const RESULT_PATH = "data/first-tournament-result.json";
const OUTPUT_DIR = "docs/first-tournament";
const OUTPUT_PATH = `${OUTPUT_DIR}/STANDINGS.md`;
const POINTS_PER_MATCH = 5;

interface Standing {
  rank: number;
  playerId: string;
  name: string;
  rating: number;
  matchPoints: number;
  matchesPlayed: number;
}

interface Verdict {
  title1: string;
  title2: string;
  item1Points: number;
  item2Points: number;
}

interface Result {
  generatedAt: string;
  standings: Standing[];
  verdicts: Verdict[];
}

interface Record {
  wins: number;
  losses: number;
  points: number;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function buildRecords(verdicts: Verdict[]): Map<string, Record> {
  const records = new Map<string, Record>();
  const ensure = (name: string): Record => {
    let record = records.get(name);
    if (!record) {
      record = { wins: 0, losses: 0, points: 0 };
      records.set(name, record);
    }
    return record;
  };

  for (const verdict of verdicts) {
    const a = ensure(verdict.title1);
    const b = ensure(verdict.title2);
    a.points += verdict.item1Points;
    b.points += verdict.item2Points;
    if (verdict.item1Points > verdict.item2Points) {
      a.wins += 1;
      b.losses += 1;
    } else if (verdict.item2Points > verdict.item1Points) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  return records;
}

async function main(): Promise<void> {
  const result = JSON.parse(await readFile(RESULT_PATH, "utf8")) as Result;
  const records = buildRecords(result.verdicts);
  const maxPoints = (result.standings[0]?.matchesPlayed ?? 0) * POINTS_PER_MATCH;

  const header = [
    "# First Tournament — Standings",
    "",
    `${result.standings.length} founder intro-post titles, judged head-to-head by Grok in a full round-robin ` +
      `(${result.verdicts.length} matches). In each match the judge split ${POINTS_PER_MATCH} points between the two ` +
      "titles; the one with more points takes the match. Ratings are Elo (start 1500, K=32).",
    "",
    `_Generated ${result.generatedAt}. Max possible points: ${maxPoints} (${result.standings[0]?.matchesPlayed ?? 0} matches × ${POINTS_PER_MATCH})._`,
    "",
    "| # | Title | Elo | W–L | Win % | Points |",
    "| --: | :-- | --: | :-: | --: | --: |",
  ];

  const rows = result.standings.map((standing, index) => {
    const record = records.get(standing.name) ?? { wins: 0, losses: 0, points: 0 };
    const games = record.wins + record.losses;
    const winPct = games > 0 ? ((100 * record.wins) / games).toFixed(1) : "0.0";
    return (
      `| ${index + 1} | ${escapeCell(standing.name)} | ${standing.rating} | ` +
      `${record.wins}–${record.losses} | ${winPct}% | ${record.points} |`
    );
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${[...header, ...rows].join("\n")}\n`);
  console.log(`Wrote ${OUTPUT_PATH} (${result.standings.length} titles)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
